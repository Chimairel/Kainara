import prisma from '@/lib/prisma';
import { NotificationType, Prisma } from '@prisma/client';
import { AppError } from '@/errors/AppError';
import { lockUserProfile } from './profile-revision.service';
import { loadUserNutritionContext, loadPlanningNutritionContext } from '@/domain/user-nutrition-context';
import { planningInputsMatch, reportProfile, reportInputsMatch } from '@/domain/planning-report.policy';
import { membershipEnabled } from '@/domain/membership.policy';
import { MembershipService } from './membership.service';
import {
  buildDeterministicNutritionGuidance,
  NUTRITION_GUIDANCE_POLICY_VERSION,
} from '@/domain/deterministic-nutrition-report.policy';
import { ProfileCycleAdaptationService, PROFILE_CHANGE_KIND } from './profile-cycle-adaptation.service';
import { UpcomingPlanPreparationService } from './upcoming-plan-preparation.service';
import { PlanningReadinessService } from './planning-readiness.service';
import {
  calculatePlanningMacroTargets,
  reportPlanningMacroTargets,
  type PlanningMacroTargets,
} from '@/domain/meal-macro-target.policy';

type StoredNutritionReport = NonNullable<Awaited<ReturnType<typeof prisma.nutritionReport.findUnique>>>;
type ReportResponse = StoredNutritionReport & {
  planningTargets: PlanningMacroTargets | null;
  referenceItems: ReturnType<typeof buildDeterministicNutritionGuidance>['referenceItems'];
  reportPolicyVersion: string | null;
  confirmationKind?: string;
  planningContext?: {
    activeVersion: number | null;
    activeGeneratedAt: Date | null;
    pendingChanges: boolean;
    safetyChanged: boolean;
    activationTier: 'LIFESTYLE' | 'HEALTH' | null;
  };
};

export class NutritionReportService {
  private static readonly generationInFlight = new Map<string, Promise<ReportResponse>>();

  static async getReport(userId: string): Promise<ReportResponse | null> {
    const report = await prisma.nutritionReport.findUnique({ where: { userId } });
    if (!report) return null;
    const [version, profile] = await Promise.all([
      prisma.nutritionReportVersion.findFirst({ where: { userId, version: report.version } }),
      prisma.userProfile.findUniqueOrThrow({ where: { userId } }),
    ]);
    const active = await prisma.nutritionReportVersion.findFirst({
      where: {
        userId,
        ...(profile.planningReportVersion
          ? { version: profile.planningReportVersion }
          : { acknowledgedAt: { not: null } }),
      },
      orderBy: { version: 'desc' },
    });
    const content = version?.content as Record<string, unknown> | undefined;
    const policyVersion = version?.policyVersion === NUTRITION_GUIDANCE_POLICY_VERSION ? version.policyVersion : null;
    const pendingChanges = Boolean(active && !planningInputsMatch(profile, active));
    const safetyChanged = Boolean(active && reportProfile(active)?.safetyRevision !== profile.safetyRevision);
    let activationTier: 'LIFESTYLE' | 'HEALTH' | null = null;
    if (active && pendingChanges && !reportInputsMatch(version, active) && membershipEnabled()) {
      activationTier =
        safetyChanged || (await MembershipService.state(userId)).requiresCaseReview ? 'HEALTH' : 'LIFESTYLE';
    }
    return {
      ...report,
      isStale: report.isStale || !policyVersion,
      referenceItems:
        policyVersion && Array.isArray(content?.referenceItems)
          ? (content.referenceItems as ReportResponse['referenceItems'])
          : [],
      reportPolicyVersion: policyVersion,
      planningTargets: reportPlanningMacroTargets(version),
      confirmationKind: version?.confirmationKind,
      planningContext: {
        activeVersion: active?.version ?? null,
        activeGeneratedAt: active?.generatedAt ?? null,
        pendingChanges,
        safetyChanged,
        activationTier,
      },
    };
  }

  static async getVersionReport(userId: string, versionNumber: number): Promise<ReportResponse | null> {
    const version = await prisma.nutritionReportVersion.findFirst({
      where: { userId, version: versionNumber },
    });
    if (!version) return null;
    const content = (version.content || {}) as Record<string, unknown>;
    const policyVersion = version.policyVersion === NUTRITION_GUIDANCE_POLICY_VERSION ? version.policyVersion : null;
    return {
      id: version.id,
      userId: version.userId,
      version: version.version,
      generatedAt: version.generatedAt,
      acknowledgedAt: version.acknowledgedAt,
      profileRevision: version.profileRevision,
      isStale: false,
      generalSummary: typeof content.generalSummary === 'string' ? content.generalSummary : '',
      foodsToAvoid: Array.isArray(content.foodsToAvoid) ? (content.foodsToAvoid as string[]) : [],
      foodsToLimit: Array.isArray(content.foodsToLimit) ? (content.foodsToLimit as string[]) : [],
      foodsRecommended: Array.isArray(content.foodsRecommended) ? (content.foodsRecommended as string[]) : [],
      drinksGuidance: Array.isArray(content.drinksGuidance) ? (content.drinksGuidance as string[]) : [],
      basedOnConditions: Array.isArray(content.basedOnConditions) ? (content.basedOnConditions as string[]) : [],
      basedOnAllergies: Array.isArray(content.basedOnAllergies) ? (content.basedOnAllergies as string[]) : [],
      referenceItems:
        policyVersion && Array.isArray(content.referenceItems)
          ? (content.referenceItems as ReportResponse['referenceItems'])
          : [],
      reportPolicyVersion: policyVersion,
      planningTargets: reportPlanningMacroTargets(version),
      confirmationKind: version.confirmationKind,
    };
  }

  static async acknowledgeReport(userId: string, expectedVersion?: number) {
    const result = await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      const report = await tx.nutritionReport.findUniqueOrThrow({ where: { userId } });
      const profile = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
      const version = await tx.nutritionReportVersion.findFirst({ where: { userId, version: report.version } });
      if (
        report.isStale ||
        report.profileRevision !== profile.revision ||
        expectedVersion !== report.version ||
        version?.policyVersion !== NUTRITION_GUIDANCE_POLICY_VERSION
      ) {
        throw new AppError(
          'This report changed or is out of date. Refresh and review the current version.',
          409,
          'REPORT_CHANGED'
        );
      }
      if (report.acknowledgedAt && (!membershipEnabled() || profile.planningReportVersion === report.version)) {
        return { acknowledged: report, firstAcknowledgment: false };
      }
      const previous = await tx.nutritionReportVersion.findFirst({
        where: {
          userId,
          ...(profile.planningReportVersion
            ? { version: profile.planningReportVersion }
            : { acknowledgedAt: { not: null } }),
        },
        orderBy: { version: 'desc' },
      });
      const sameInputs = reportInputsMatch(version, previous);
      // First-ever activation and unchanged confirmations are free. The client cannot assert unchanged inputs.
      if ((previous || profile.firstReportAcknowledgedAt) && !sameInputs && membershipEnabled()) {
        const membership = await MembershipService.state(userId, new Date(), tx);
        if (
          membership.requiresCaseReview ||
          (previous && reportProfile(previous)?.safetyRevision !== profile.safetyRevision)
        )
          await MembershipService.assertHealth(userId, tx);
        else await MembershipService.assertEnhanced(userId, tx);
      }
      const acknowledgedAt = report.acknowledgedAt ?? new Date();
      const firstAcknowledgment = !report.acknowledgedAt;
      await tx.nutritionReportVersion.updateMany({
        where: { userId, version: report.version },
        data: { acknowledgedAt },
      });
      const acknowledged = await tx.nutritionReport.update({ where: { userId }, data: { acknowledgedAt } });
      await tx.userProfile.update({
        where: { userId },
        data: {
          planningReportVersion: report.version,
          firstReportAcknowledgedAt: profile.firstReportAcknowledgedAt ?? previous?.acknowledgedAt ?? acknowledgedAt,
        },
      });
      if (previous && !sameInputs && reportProfile(previous)?.safetyRevision === profile.safetyRevision) {
        const priorProfile = reportProfile(previous);
        const kinds: Array<(typeof PROFILE_CHANGE_KIND)[keyof typeof PROFILE_CHANGE_KIND]> = [
          PROFILE_CHANGE_KIND.BODY_TARGETS,
          PROFILE_CHANGE_KIND.FOOD_PREFERENCES,
        ];
        if (
          priorProfile?.shoppingDayOfWeek !== profile.shoppingDayOfWeek ||
          priorProfile?.shoppingDayGroup !== profile.shoppingDayGroup
        )
          kinds.push(PROFILE_CHANGE_KIND.SHOPPING_SCHEDULE);
        await ProfileCycleAdaptationService.recordOrdinaryChange(tx, userId, profile.revision, kinds);
      }
      await ProfileCycleAdaptationService.acknowledgeProfileRevision(tx, userId, profile.revision);
      return { acknowledged, firstAcknowledgment };
    });
    // A post-commit advisory failure cannot turn a saved receipt into a failed save.
    const planningReadiness = await PlanningReadinessService.getForUser(userId).catch(() => {
      console.error('[NutritionReportService] Saved acknowledgment; planning-readiness lookup unavailable.');
      return null;
    });
    if (result.firstAcknowledgment && planningReadiness) {
      try {
        await prisma.notification.create({
          data: {
            userId,
            title: planningReadiness.title,
            message: planningReadiness.message,
            type: planningReadiness.canRequestPlan ? NotificationType.ASSIGNMENT : NotificationType.REVIEW_REQUEST,
          },
        });
      } catch (error) {
        console.error('[NutritionReportService] Planning-readiness notification failed:', error);
      }
    }
    if (result.firstAcknowledgment) UpcomingPlanPreparationService.triggerNonBlocking(userId);
    return { report: result.acknowledged, planningReadiness };
  }

  static async keepPreviousReport(userId: string) {
    const context = await loadPlanningNutritionContext(prisma, userId, 'Your previous planning report is unavailable.');
    return {
      activeVersion: context.profile.planningReportVersion,
      planningReadiness: await PlanningReadinessService.getForUser(userId),
    };
  }

  static async getHistory(userId: string) {
    const versions = await prisma.nutritionReportVersion.findMany({
      where: { userId },
      orderBy: { version: 'desc' },
      take: 100,
    });
    return versions.map((version) => ({
      ...version,
      content: {
        ...(version.content as Record<string, unknown>),
        planningTargets: reportPlanningMacroTargets(version),
      },
    }));
  }

  static async generateReport(userId: string): Promise<ReportResponse> {
    const existing = this.generationInFlight.get(userId);
    if (existing) return existing;
    const request = prisma
      .$transaction(
        async (tx) => {
          await lockUserProfile(tx, userId);
          return this.publishInTransaction(tx, userId);
        },
        { maxWait: 10000, timeout: 30000 }
      )
      .then(async () => (await this.getReport(userId))!)
      .finally(() => {
        if (this.generationInFlight.get(userId) === request) this.generationInFlight.delete(userId);
      });
    this.generationInFlight.set(userId, request);
    return request;
  }

  /** Used by check-ins in the same transaction as their durable weekly record. */
  static async publishInTransaction(tx: Prisma.TransactionClient, userId: string, confirmationKind = 'PROFILE_UPDATE') {
    const { profile, safetyRestrictions, conditions, allergens, otherConditions, otherAllergies } =
      await loadUserNutritionContext(tx, userId, 'Complete your profile before preparing nutrition guidance.');
    const { age, heightCm, weightKg, goal, activityLevel, dailyCalorieTarget } = profile;
    if (!age || !heightCm || !weightKg || !goal || !activityLevel || !dailyCalorieTarget)
      throw new Error('Please complete your statistics and goals before preparing nutrition guidance.');
    const guidance = buildDeterministicNutritionGuidance({
      age,
      dailyCalories: dailyCalorieTarget,
      weightKg,
      conditions,
      allergens,
      otherConditions: safetyRestrictions.customConditions,
      otherFoodRestrictions: safetyRestrictions.customFoodRestrictions,
    });
    const savedReport = {
      userId,
      generalSummary: guidance.generalSummary,
      foodsToAvoid: [] as string[],
      foodsToLimit: [] as string[],
      foodsRecommended: [] as string[],
      drinksGuidance: [] as string[],
      basedOnConditions: [...conditions, ...safetyRestrictions.customConditions],
      basedOnAllergies: [...allergens, ...safetyRestrictions.customFoodRestrictions],
    };
    const planningTargets = calculatePlanningMacroTargets({
      ...profile,
      restricted: conditions.some((c) => c !== 'NONE') || Boolean(otherConditions),
    });
    const latest = await tx.nutritionReportVersion.findFirst({ where: { userId }, orderBy: { version: 'desc' } });
    const current = await tx.nutritionReport.findUnique({ where: { userId } });
    const version = Math.max(current?.version ?? 0, latest?.version ?? 0) + 1;
    const generatedAt = new Date();
    const data = {
      ...savedReport,
      generatedAt,
      version,
      profileRevision: profile.revision,
      isStale: false,
      acknowledgedAt: null,
    };
    await tx.nutritionReportVersion.create({
      data: {
        userId,
        version,
        profileRevision: profile.revision,
        generatedAt,
        confirmationKind,
        policyVersion: NUTRITION_GUIDANCE_POLICY_VERSION,
        content: JSON.parse(JSON.stringify({ ...savedReport, ...guidance, planningTargets })) as Prisma.InputJsonObject,
        profileSnapshot: JSON.parse(
          JSON.stringify({
            profile,
            conditions,
            allergens,
            otherConditions,
            otherAllergies,
            nutritionReferences: guidance.nutritionReferences,
            planningTargets,
          })
        ) as Prisma.InputJsonObject,
      },
    });
    return tx.nutritionReport.upsert({ where: { userId }, update: data, create: data });
  }
}

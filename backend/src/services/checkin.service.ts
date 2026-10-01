import prisma from '@/lib/prisma';
import { MembershipService } from './membership.service';
import { membershipEnabled, membershipWeek } from '@/domain/membership.policy';
import { lockUserProfile, advanceProfileRevision } from './profile-revision.service';
import { calculateDailyTarget } from '@/lib/calculations';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { NutritionReportService } from './nutrition-report.service';
import { planningInputsMatch, reportProfile, reportInputsMatch } from '@/domain/planning-report.policy';
import { AppError } from '@/errors/AppError';
import { evaluateWeeklyAdaptation } from '@/domain/weekly-adaptation.policy';
import type { WeeklyCheckinInput } from '@/validation/checkin.schemas';
import { deriveMissedCheckinCycles } from '@/domain/checkin-cycle.policy';
import { ActivityLevel, Goal, WeeklyAdaptationState } from '@prisma/client';

export class CheckinService {
  static async getCheckinStatus(userId: string) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      include: { user: { select: { createdAt: true } } },
    });
    if (!profile) return { isDue: false, streak: 0, lastCheckinAt: null, latestAdaptation: null };
    const active = await prisma.nutritionReportVersion.findFirst({
      where: {
        userId,
        ...(profile.planningReportVersion
          ? { version: profile.planningReportVersion }
          : { acknowledgedAt: { not: null } }),
      },
      orderBy: { version: 'desc' },
    });
    const now = new Date();
    const cycle = await MealPlanCycleService.getCurrentCycle(userId, now);
    const cycleStartDate = cycle?.startDate ?? membershipWeek(now).start;
    const submitted = await prisma.weeklyCheckin.findUnique({
      where: { userId_cycleStartDate: { userId, cycleStartDate } },
    });
    const anchor =
      profile.lastCheckinAt ?? profile.firstReportAcknowledgedAt ?? active?.acknowledgedAt ?? profile.user.createdAt;
    const nextDueAt = new Date(anchor.getTime() + 7 * 86_400_000);
    return {
      isDue: Boolean(active) && !submitted && now >= nextDueAt,
      streak: profile.checkinStreak,
      lastCheckinAt: profile.lastCheckinAt,
      nextDueAt,
      missedCycles: deriveMissedCheckinCycles(anchor, now, Boolean(submitted)),
      latestAdaptation: submitted,
      profileRevision: profile.revision,
      hasPendingChanges: Boolean(active && !planningInputsMatch(profile, active)),
      safetyChanged: Boolean(active && reportProfile(active)?.safetyRevision !== profile.safetyRevision),
      activePlanningVersion: active?.version ?? null,
      activeGeneratedAt: active?.generatedAt ?? null,
      weeksSinceConfirmation: Math.max(0, Math.floor((now.getTime() - anchor.getTime()) / (7 * 86_400_000))),
    };
  }

  static async submitCheckin(userId: string, data: WeeklyCheckinInput) {
    const now = new Date();
    const status = await this.getCheckinStatus(userId);
    const cycle = await MealPlanCycleService.getCurrentCycle(userId, now);
    const cycleStartDate = cycle?.startDate ?? membershipWeek(now).start;
    const existing = await prisma.weeklyCheckin.findUnique({
      where: { userId_cycleStartDate: { userId, cycleStartDate } },
    });
    if (existing) return { ...existing, duplicate: true };
    if (!status.isDue) throw new AppError('Your next weekly check-in is not due yet.', 409, 'CHECKIN_NOT_DUE');
    const enhanced = !membershipEnabled() || (await MembershipService.state(userId)).enhanced;
    const observationStart = new Date(now.getTime() - 21 * 86_400_000);
    const [weights, adherence] = enhanced
      ? await Promise.all([
          prisma.weightLog.findMany({
            where: { userId, loggedAt: { gte: observationStart } },
            orderBy: { loggedAt: 'asc' },
            select: { weightKg: true, loggedAt: true },
          }),
          prisma.dailyNutritionLog.findMany({
            where: { userId, logDate: { gte: observationStart } },
            orderBy: { logDate: 'asc' },
            select: { adherencePct: true, logDate: true },
          }),
        ])
      : [[], []];
    return prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        const recorded = await tx.weeklyCheckin.findUnique({
          where: { userId_cycleStartDate: { userId, cycleStartDate } },
        });
        if (recorded) return { ...recorded, duplicate: true };
        const profile = await tx.userProfile.findUniqueOrThrow({ where: { userId } });
        if (data.profileRevision !== undefined && data.profileRevision !== profile.revision)
          throw new AppError('Your profile changed. Refresh before submitting your check-in.', 409, 'PROFILE_CHANGED');
        if (profile.lastCheckinAt && now.getTime() < profile.lastCheckinAt.getTime() + 7 * 86_400_000)
          throw new AppError('Your next weekly check-in is not due yet.', 409, 'CHECKIN_NOT_DUE');
        const active = await tx.nutritionReportVersion.findFirst({
          where: {
            userId,
            ...(profile.planningReportVersion
              ? { version: profile.planningReportVersion }
              : { acknowledgedAt: { not: null } }),
          },
          orderBy: { version: 'desc' },
        });
        const updates = data.changed ? data.updates : {};
        if (data.changed && !Object.keys(updates).length && data.profileRevision === undefined)
          throw new AppError('Review the current profile before confirming saved updates.', 409, 'PROFILE_CHANGED');
        const effectiveWeightKg = updates.weightKg ?? profile.weightKg;
        const effectiveGoal = (updates.goal as Goal | undefined) ?? profile.goal;
        const effectiveActivityLevel = (updates.activityLevel as ActivityLevel | undefined) ?? profile.activityLevel;
        const conditions = await tx.healthCondition.findMany({ where: { userId } });
        const dailyCalorieTarget =
          Object.keys(updates).length &&
          profile.age &&
          profile.heightCm &&
          effectiveWeightKg &&
          effectiveGoal &&
          effectiveActivityLevel
            ? calculateDailyTarget({
                age: profile.age,
                heightCm: profile.heightCm,
                weightKg: effectiveWeightKg,
                goal: effectiveGoal,
                activityLevel: effectiveActivityLevel,
                biologicalSex: profile.biologicalSex as 'MALE' | 'FEMALE',
                hasPregnantCondition: conditions.some(({ condition }) => condition === 'PREGNANT'),
              }).dailyCalorieTarget
            : profile.dailyCalorieTarget;
        const adaptation = enhanced
          ? evaluateWeeklyAdaptation({
              goal: effectiveGoal,
              weights: updates.weightKg ? [...weights, { weightKg: updates.weightKg, loggedAt: now }] : weights,
              adherence,
            })
          : null;
        const streak =
          profile.lastCheckinAt && now.getTime() - profile.lastCheckinAt.getTime() <= 14 * 86_400_000
            ? profile.checkinStreak + 1
            : 1;
        await tx.userProfile.update({
          where: { userId },
          data: {
            ...(updates.weightKg !== undefined ? { weightKg: updates.weightKg } : {}),
            ...(updates.goal !== undefined ? { goal: updates.goal as Goal } : {}),
            ...(updates.activityLevel !== undefined ? { activityLevel: updates.activityLevel as ActivityLevel } : {}),
            dailyCalorieTarget,
            lastCheckinAt: now,
            checkinStreak: streak,
          },
        });
        const changed =
          effectiveWeightKg !== profile.weightKg ||
          effectiveGoal !== profile.goal ||
          effectiveActivityLevel !== profile.activityLevel ||
          dailyCalorieTarget !== profile.dailyCalorieTarget;
        if (changed) await advanceProfileRevision(tx, userId);
        if (enhanced && updates.weightKg !== undefined)
          await tx.weightLog.create({ data: { userId, weightKg: updates.weightKg, note: 'Weekly check-in' } });
        const report = await NutritionReportService.publishInTransaction(
          tx,
          userId,
          data.changed || changed ? 'PROFILE_UPDATE' : 'UNCHANGED_CHECKIN'
        );
        const published = await tx.nutritionReportVersion.findFirst({ where: { userId, version: report.version } });
        if (!data.changed && !reportInputsMatch(published, active))
          throw new AppError(
            'Your saved profile differs from your planning report. Confirm your saved updates or correct them first.',
            409,
            'PROFILE_UPDATES_PENDING'
          );
        const checkin = await tx.weeklyCheckin.create({
          data: {
            userId,
            cycleStartDate,
            changed: data.changed || changed,
            reportVersion: report.version,
            submittedWeightKg: updates.weightKg,
            submittedGoal: updates.goal as Goal | undefined,
            submittedActivityLevel: updates.activityLevel as ActivityLevel | undefined,
            weightTrendKg: adaptation?.weightTrendKg,
            averageAdherencePct: adaptation?.averageAdherencePct,
            observationDays: adaptation?.observationDays ?? 0,
            adaptationState: (adaptation?.state ?? 'INSUFFICIENT_DATA') as WeeklyAdaptationState,
            profileSnapshot: {
              profileRevision: report.profileRevision,
              weightKg: effectiveWeightKg,
              goal: effectiveGoal,
              activityLevel: effectiveActivityLevel,
              dailyCalorieTarget,
              automaticCalorieAdjustment: false,
            },
          },
        });
        return {
          ...checkin,
          duplicate: false,
          streak,
          explanation: adaptation?.explanation ?? 'Profile confirmed. Review your new dated nutrition report.',
          automaticCalorieAdjustment: false,
        };
      },
      { maxWait: 10000, timeout: 30000 }
    );
  }
}

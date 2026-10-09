import { MealPlanGenerationJobStatus, MealPlanCycleStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import { hasCurrentConsent } from '@/domain/onboarding.policy';
import { getOnDemandMealPlanWindow, getScheduledMealDate } from '@/domain/meal-plan-cycle.policy';
import { PlanningReadinessService } from './planning-readiness.service';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { MealGenerationService } from './meal-generation.service';
import { acknowledgedRebuild } from './acknowledged-cycle-rebuild.service';
import { MembershipService } from './membership.service';
import { AppError } from '@/errors/AppError';

type Account = NonNullable<Awaited<ReturnType<typeof loadAccount>>>;

async function loadAccount(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true,
      isSuspended: true,
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      acceptedTermsVersion: true,
      acceptedPrivacyVersion: true,
      nutritionReport: { select: { acknowledgedAt: true, isStale: true, profileRevision: true } },
      userProfile: { select: { revision: true, shoppingDayOfWeek: true, shoppingDayGroup: true } },
    },
  });
}

export function isReadyForAutomaticCurrentPlan(account: Account | null): boolean {
  return Boolean(
    account &&
    account.role === 'USER' &&
    !account.isSuspended &&
    account.emailVerified &&
    account.onboardingDone &&
    hasCurrentConsent(account) &&
    account.userProfile &&
    account.nutritionReport?.acknowledgedAt &&
    !account.nutritionReport.isStale &&
    account.nutritionReport.profileRevision === account.userProfile.revision
  );
}

export class CurrentPlanPreparationService {
  static async getCurrentWindowJobStatus(userId: string, now: Date = new Date()) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: { shoppingDayOfWeek: true, shoppingDayGroup: true },
    });
    if (!profile) return null;
    const window = getOnDemandMealPlanWindow(profile, now);
    return prisma.mealPlanGenerationJob.findUnique({
      where: {
        userId_planType_cycleStartDate: {
          userId,
          planType: window.planType,
          cycleStartDate: window.startDate,
        },
      },
      select: { status: true },
    });
  }

  static async ensureForUser(
    userId: string,
    now: Date = new Date()
  ): Promise<{
    state: 'NOT_READY' | 'EXISTING' | 'PREPARING' | 'PREPARED' | 'FAILED';
    planGroupId: string | null;
  }> {
    const account = await loadAccount(userId);
    if (!isReadyForAutomaticCurrentPlan(account)) return { state: 'NOT_READY', planGroupId: null };

    const current = await MealPlanCycleService.getCurrentCycle(userId, now);
    const repair = current ? await acknowledgedRebuild(userId, current.id, now) : null;
    const readiness = await PlanningReadinessService.getForUser(userId);
    const paidSafetyRepair = repair && readiness.status === 'BLOCKED_MEMBERSHIP' &&
      await MembershipService.isSafetyRepair(userId, current!.startDate, prisma, now);
    if (!readiness.canRequestPlan && !paidSafetyRepair) return { state: 'NOT_READY', planGroupId: null };
    if (repair) {
      try {
        const planGroupId = await MealGenerationService.generateWindowOnce(userId, repair.window, true, undefined, undefined, repair);
        return { state: 'PREPARED', planGroupId };
      } catch (error) {
        if (error instanceof AppError && error.errorCode === 'PLAN_REPAIR_HISTORY_CONFLICT') return { state: 'FAILED', planGroupId: current!.id };
        if (error instanceof AppError && error.errorCode === 'GENERATION_IN_PROGRESS') return { state: 'PREPARING', planGroupId: null };
        if (error instanceof AppError && error.errorCode === 'MEAL_REVIEW_CONTEXT_CHANGED') {
          const replacement = await MealPlanCycleService.getCurrentCycle(userId, now);
          if (replacement && replacement.id !== current!.id && replacement.snapshot?.profileRevision === account!.userProfile!.revision)
            return { state: 'EXISTING', planGroupId: replacement.id };
        }
        throw error;
      }
    }
    if (current) return { state: 'EXISTING', planGroupId: current.id };

    const window = getOnDemandMealPlanWindow(account!.userProfile!, now);
    const endDate = getScheduledMealDate(window.startDate, window.numDays - 1);
    const existing = await prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        planType: window.planType,
        startDate: window.startDate,
        endDate,
        status: { not: MealPlanCycleStatus.SUPERSEDED },
      },
      select: { id: true },
    });
    if (existing) return { state: 'EXISTING', planGroupId: existing.id };

    const job = await CurrentPlanPreparationService.getCurrentWindowJobStatus(userId, now);
    if (job?.status === MealPlanGenerationJobStatus.FAILED) return { state: 'FAILED', planGroupId: null };
    if (job && job.status !== MealPlanGenerationJobStatus.COMPLETED) {
      return { state: 'PREPARING', planGroupId: null };
    }

    try {
      const planGroupId = await MealGenerationService.generateWindowOnce(userId, window);
      return { state: 'PREPARED', planGroupId };
    } catch (error) {
      const concurrentJob = await CurrentPlanPreparationService.getCurrentWindowJobStatus(userId, now);
      if (
        concurrentJob &&
        (concurrentJob.status === MealPlanGenerationJobStatus.GENERATING ||
          concurrentJob.status === MealPlanGenerationJobStatus.WAITING_FOR_AI ||
          concurrentJob.status === MealPlanGenerationJobStatus.PROCESSING_AI)
      ) {
        return { state: 'PREPARING', planGroupId: null };
      }
      throw error;
    }
  }
}

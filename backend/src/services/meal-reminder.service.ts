import prisma from '@/lib/prisma';
import { hasCurrentConsent } from '@/domain/onboarding.policy';
import { dueMealReminders, MealSchedule, ReminderMealType, REMINDER_WINDOW_MS } from '@/domain/meal-reminder.policy';
import { getManilaDateKey, getManilaMidnight } from '@/domain/meal-plan-cycle.policy';
import { UserProfileService } from './user-profile.service';
import { MealPlanCycleService } from './meal-plan-cycle.service';
import { WebPushService, pushConfiguration } from './web-push.service';

export class MealReminderService {
  static async saveSettings(userId: string, settings: MealSchedule) {
    return prisma.mealReminderSettings.upsert({ where: { userId }, create: { userId, ...settings }, update: settings });
  }

  static async eligibleMeal(userId: string, day: string, mealType: ReminderMealType, mealId?: string) {
    const account = await UserProfileService.getAuthenticatedProfileDetails(userId);
    const report = account?.profile.nutritionReport;
    const reportAcknowledged =
      account?.profile.reportAcknowledged ??
      Boolean(
        report?.acknowledgedAt && !report.isStale && report.profileRevision === account?.profile.userProfile?.revision
      );
    if (
      !account ||
      account.role !== 'USER' ||
      account.isSuspended ||
      !account.profile.emailVerified ||
      !account.profile.onboardingDone ||
      !hasCurrentConsent(account.profile) ||
      !reportAcknowledged
    )
      return null;
    // Date labels in existing plans are Manila business dates; eating times use the user's timezone.
    const date = getManilaMidnight(day);
    const cycles = await prisma.mealPlanCycle.findMany({
      where: {
        userId,
        startDate: { lte: date },
        endDate: { gte: date },
        status: { notIn: ['SUPERSEDED', 'REVALIDATION_REQUIRED'] },
      },
      orderBy: [{ startDate: 'desc' }, { cycleRevision: 'desc' }],
      take: 1,
    });
    const cycle = cycles[0];
    if (!cycle) return null;
    const cleared = await MealPlanCycleService.getClearedMealPlanIds(userId, cycle.id);
    const meals = await prisma.mealPlan.findMany({
      where: {
        userId,
        planGroupId: cycle.id,
        id: { in: cleared },
        mealType,
        status: 'APPROVED',
        requiresSafetyRevalidation: false,
      },
      include: { mealLogs: { where: { userId, voidedAt: null } } },
    });
    return (
      meals.find(
        (meal) =>
          (!mealId || meal.id === mealId) &&
          getManilaDateKey(meal.scheduledDate) === day &&
          !meal.mealLogs.some((log) => log.status === 'DONE' || log.status === 'SKIPPED')
      ) ?? null
    );
  }

  static async createDueReminders(now = new Date()) {
    let cursor: string | undefined;
    let created = 0;
    do {
      const settings = await prisma.mealReminderSettings.findMany({
        where: { remindersEnabled: true },
        orderBy: { userId: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { userId: cursor }, skip: 1 } : {}),
      });
      for (const schedule of settings) {
        for (const due of dueMealReminders(schedule, now)) {
          const meal = await this.eligibleMeal(schedule.userId, due.day, due.mealType);
          if (!meal) continue;
          const mealLabel = due.mealType.toLowerCase();
          const previousKey = `meal-reminder:${schedule.userId}:${due.day}:${due.mealType}:${due.kind}`;
          // Preserve legacy reminders for this exact due time across an update.
          const legacy = await prisma.notification.findUnique({
            where: { deduplicationKey: previousKey },
            select: { expiresAt: true },
          });
          if (legacy?.expiresAt?.getTime() === due.expiresAt.getTime()) continue;
          const key = `${previousKey}:${due.dueAt.toISOString()}`;
          const result = await prisma.notification.createMany({
            skipDuplicates: true,
            data: [
              {
                userId: schedule.userId,
                deduplicationKey: key,
                type: 'MEAL_REMINDER',
                title: due.kind === 'PREPARE' ? `Time to prepare ${mealLabel}` : `Remember to log ${mealLabel}`,
                message:
                  due.kind === 'PREPARE'
                    ? 'Your planned meal is available. Open KAINARA to get ready.'
                    : 'Your planned meal is still unlogged. Open KAINARA to record it or mark it skipped.',
                targetPath: `/meals?date=${due.day}`,
                expiresAt: due.expiresAt,
                context: {
                  mealId: meal.id,
                  day: due.day,
                  mealType: due.mealType,
                  kind: due.kind,
                  dueAt: due.dueAt.toISOString(),
                },
              },
            ],
          });
          created += result.count;
        }
      }
      cursor = settings.length === 100 ? settings[settings.length - 1].userId : undefined;
    } while (cursor);
    return created;
  }

  static async stillEligible(
    notification: { userId: string; context: unknown; expiresAt?: Date | null },
    now = new Date()
  ) {
    const context = notification.context as {
      mealId?: string;
      day?: string;
      mealType?: ReminderMealType;
      kind?: string;
      dueAt?: string;
      test?: boolean;
    } | null;
    if (context?.test) return true;
    if (!context?.mealId || !context.day || !context.mealType) return false;
    const settings = await prisma.mealReminderSettings.findUnique({ where: { userId: notification.userId } });
    if (!settings) return false;
    // Older reminders record the due instant through their fixed expiry window.
    const originalDueAt = context.dueAt
      ? Date.parse(context.dueAt)
      : notification.expiresAt
        ? notification.expiresAt.getTime() - REMINDER_WINDOW_MS
        : NaN;
    const due = dueMealReminders(settings, now).some(
      (item) =>
        item.day === context.day &&
        item.mealType === context.mealType &&
        item.kind === context.kind &&
        item.dueAt.getTime() === originalDueAt
    );
    return due && Boolean(await this.eligibleMeal(notification.userId, context.day, context.mealType, context.mealId));
  }

  static async run() {
    if (!pushConfiguration()) return { enabled: false, created: 0, sent: 0 };
    const created = await this.createDueReminders();
    let sent = 0;
    let cursor: string | undefined;
    do {
      const subscriptions = await prisma.webPushSubscription.findMany({
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const subscription of subscriptions) {
        const account = await prisma.user.findUnique({
          where: { id: subscription.userId },
          select: { isSuspended: true, emailVerified: true },
        });
        if (!account || account.isSuspended || !account.emailVerified) continue;
        const notifications = await prisma.notification.findMany({
          where: {
            userId: subscription.userId,
            isRead: false,
            createdAt: { gte: new Date(Math.max(subscription.createdAt.getTime(), Date.now() - 600_000)) },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            pushDeliveries: { none: { subscriptionId: subscription.id } },
          },
          orderBy: { createdAt: 'asc' },
          take: 50,
        });
        for (const notification of notifications) {
          // Manual tests are sent by their request, to its selected device only.
          // A background claim can otherwise make that request report a false failure.
          if ((notification.context as { test?: boolean } | null)?.test) continue;
          const eligible = notification.type === 'MEAL_REMINDER' ? () => this.stillEligible(notification) : undefined;
          if (await WebPushService.deliver(subscription.id, notification.id, eligible)) sent++;
        }
      }
      cursor = subscriptions.length === 100 ? subscriptions[subscriptions.length - 1].id : undefined;
    } while (cursor);
    return { enabled: true, created, sent };
  }
}

let running: Promise<{ enabled: boolean; created: number; sent: number }> | null = null;
export function triggerMealReminders() {
  if (!running)
    running = MealReminderService.run().finally(() => {
      running = null;
    });
  return running;
}
export async function waitForMealReminders() {
  await running?.catch(() => undefined);
}
export function triggerMealRemindersInBackground() {
  void triggerMealReminders().catch(() =>
    console.warn('[Meal reminders] Worker failed; no private notification data logged.')
  );
}

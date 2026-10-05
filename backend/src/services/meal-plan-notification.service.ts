import { NotificationService } from './notification.service';
import { MealPlanStatus, NotificationType, PlanType } from '@prisma/client';
import prisma from '@/lib/prisma';

/** Notifications follow the plan commit. Their failure must not undo a plan or spend another review allowance. */
export async function notifyPreparedPlan(
  userId: string,
  planType: PlanType,
  endDate: Date,
  plans: readonly { status: MealPlanStatus }[]
) {
  if (plans.some((plan) => plan.status === MealPlanStatus.PENDING_REVIEW)) {
    try {
      await prisma.notification.create({
        data: {
          userId,
          title: 'New Meal Plan Awaiting Verification',
          message: 'Your new plan contains meals awaiting nutritionist review before use.',
          type: NotificationType.REVIEW_REQUEST,
        },
      });
    } catch (error) {
      console.warn('[Meal Generation] Could not create review notification:', error);
    }
    try {
      await NotificationService.notifyReviewers(
        'New plan awaiting review',
        'A new meal plan is ready in the case review queue.'
      );
    } catch (error) {
      console.warn('[Meal Generation] Could not notify reviewers:', error);
    }
  }
  if (planType === PlanType.STARTER && plans.length > 0) {
    const nextStart = new Date(endDate.getTime() + 86_400_000);
    const dateStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(nextStart);
    try {
      await prisma.notification.create({
        data: {
          userId,
          title: 'Starter Meal Plan Preparing',
          message: `Your kickoff bridge plan has saved candidates. Empty slots and nutritionist reviews may still be pending. Your full 7-day weekly cycle begins on ${dateStr}.`,
          type: NotificationType.ASSIGNMENT,
        },
      });
    } catch (error) {
      console.warn('[Meal Generation] Could not create starter plan notification:', error);
    }
  }
}

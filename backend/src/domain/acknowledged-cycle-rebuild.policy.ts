import type { PlanType } from '@prisma/client';
import { getStartOfManilaBusinessDay } from './meal-actionability.policy';
import type { MealPlanGenerationWindow } from './meal-plan-cycle.policy';

export function remainingCycleWindow(cycle: { planType: PlanType; startDate: Date; endDate: Date }, now = new Date()): MealPlanGenerationWindow | null {
  const today = getStartOfManilaBusinessDay(now);
  const startDate = cycle.startDate > today ? cycle.startDate : today;
  const days = Math.round((getStartOfManilaBusinessDay(cycle.endDate).getTime() - getStartOfManilaBusinessDay(startDate).getTime()) / 86400000) + 1;
  return days > 0 && days <= 7 ? { planType: cycle.planType, startDate, numDays: days } : null;
}

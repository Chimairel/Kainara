import type { MealPlan } from '@/types';
import type { RetainedMealLog } from './RetainedMealLogs';
import type { CurrentPlanSnapshot, PendingReviewState } from './meals-workspace.types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';

/** Derive display data without fetching, mutating plans or changing selection. */
export function mealPlanPresentation({
  meals,
  pendingReview,
  retainedMealLogs,
  cycles,
  selectedPlanDateKey,
}: {
  meals: MealPlan[];
  pendingReview: PendingReviewState | null;
  retainedMealLogs: RetainedMealLog[];
  cycles: CurrentPlanSnapshot['cycles'];
  selectedPlanDateKey: string | null;
}) {
  // Group meals by date
  const groupMealsByDate = () => {
    const grouped: Record<string, MealPlan[]> = {};

    meals.forEach((meal) => {
      const dateKey = getManilaDateKey(meal.scheduledDate);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    // Sort the keys chronologically
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((dateKey) => {
        const dayMeals = grouped[dateKey];
        const parsedDate = manilaDateFromKey(dateKey);
        const weekday = formatManilaDate(parsedDate, { weekday: 'long' });
        const dateStr = formatManilaDate(parsedDate, { month: 'short', day: 'numeric' });

        // Sum calories and macros targets for the day
        const dayCalories = dayMeals.reduce((sum, m) => sum + m.calories, 0);
        const dayProtein = dayMeals.reduce((sum, m) => sum + m.proteinG, 0);
        const dayCarbs = dayMeals.reduce((sum, m) => sum + m.carbsG, 0);
        const dayFat = dayMeals.reduce((sum, m) => sum + m.fatG, 0);

        return {
          dateKey,
          weekday,
          dateStr,
          mealsList: dayMeals,
          dayCalories,
          dayProtein,
          dayCarbs,
          dayFat,
        };
      });
  };

  const groupPendingMealsByDate = () => {
    const grouped: Record<string, PendingMealPreview[]> = {};

    pendingReview?.meals.forEach((meal) => {
      const dateKey = getManilaDateKey(meal.scheduledDate);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(meal);
    });

    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((dateKey) => {
        const parsedDate = manilaDateFromKey(dateKey);
        return {
          dateKey,
          weekday: formatManilaDate(parsedDate, { weekday: 'long' }),
          dateStr: formatManilaDate(parsedDate, { month: 'short', day: 'numeric' }),
          mealsList: grouped[dateKey],
        };
      });
  };

  const groupedDays = groupMealsByDate();
  const groupedPendingDays = groupPendingMealsByDate();
  const displayedPlanDays = Array.from(
    new Set([
      ...groupedDays.map((day) => day.dateKey),
      ...groupedPendingDays.map((day) => day.dateKey),
      ...retainedMealLogs.map((meal) => getManilaDateKey(meal.scheduledDate)),
    ])
  )
    .sort((a, b) => a.localeCompare(b))
    .map((dateKey) => {
      const approvedDay = groupedDays.find((day) => day.dateKey === dateKey);
      const pendingDay = groupedPendingDays.find((day) => day.dateKey === dateKey);
      const parsedDate = manilaDateFromKey(dateKey);
      return {
        dateKey,
        weekday: approvedDay?.weekday ?? pendingDay?.weekday ?? formatManilaDate(parsedDate, { weekday: 'long' }),
        dateStr:
          approvedDay?.dateStr ??
          pendingDay?.dateStr ??
          formatManilaDate(parsedDate, { month: 'short', day: 'numeric' }),
        mealsList: [...(approvedDay?.mealsList ?? []), ...(pendingDay?.mealsList ?? [])],
      };
    });
  const selectedPlanDayIndex = Math.max(
    0,
    displayedPlanDays.findIndex((day) => day.dateKey === selectedPlanDateKey)
  );
  const selectedPlanDay = displayedPlanDays[selectedPlanDayIndex] ?? null;
  const isStarterPlan =
    cycles?.current?.planType === 'STARTER' ||
    (!cycles?.current && (meals[0]?.planType === 'STARTER' || pendingReview?.planType === 'STARTER'));

  const starterMeals = [
    ...meals.filter((m) => m.planType === 'STARTER'),
    ...(pendingReview?.meals?.filter((m) => m.planType === 'STARTER') ?? []),
  ].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());

  const starterFirstDate =
    isStarterPlan && starterMeals.length > 0
      ? manilaDateFromKey(getManilaDateKey(starterMeals[0].scheduledDate))
      : isStarterPlan && cycles?.current?.startDate
        ? manilaDateFromKey(getManilaDateKey(cycles.current.startDate))
        : null;

  const starterLastDate =
    isStarterPlan && starterMeals.length > 0
      ? manilaDateFromKey(getManilaDateKey(starterMeals[starterMeals.length - 1].scheduledDate))
      : isStarterPlan && cycles?.current?.endDate
        ? manilaDateFromKey(getManilaDateKey(cycles.current.endDate))
        : null;

  const nextCycleDay = (() => {
    if (!isStarterPlan) return null;
    if (cycles?.upcoming?.startDate) {
      return formatManilaDate(manilaDateFromKey(getManilaDateKey(cycles.upcoming.startDate)), {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
    const weeklyMeals = [
      ...meals.filter((m) => m.planType === 'WEEKLY'),
      ...(pendingReview?.meals?.filter((m) => m.planType === 'WEEKLY') ?? []),
    ].sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime());
    if (weeklyMeals.length > 0) {
      return formatManilaDate(manilaDateFromKey(getManilaDateKey(weeklyMeals[0].scheduledDate)), {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      });
    }
    if (starterLastDate) {
      const dayAfter = new Date(starterLastDate);
      dayAfter.setDate(dayAfter.getDate() + 1);
      return formatManilaDate(dayAfter, { weekday: 'long', month: 'short', day: 'numeric' });
    }
    return null;
  })();
  const displayedMealCount = meals.length + retainedMealLogs.length + (pendingReview?.mealCount ?? 0);
  const completedMealCount =
    meals.filter((meal) => meal.mealLogs?.some((log) => log.status === 'DONE')).length +
    retainedMealLogs.filter((meal) => meal.status === 'DONE').length;
  return {
    groupedDays,
    groupedPendingDays,
    displayedPlanDays,
    selectedPlanDayIndex,
    selectedPlanDay,
    isStarterPlan,
    starterFirstDate,
    starterLastDate,
    nextCycleDay,
    displayedMealCount,
    completedMealCount,
  };
}

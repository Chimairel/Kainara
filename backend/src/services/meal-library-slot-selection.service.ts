import { MealType, type UserProfile } from '@prisma/client';
import { mealMacroBudget, type NutritionVector, type PlanningMacroTargets } from '@/domain/meal-macro-target.policy';
import { planningSlotNutritionScore } from '@/domain/swap-nutrition-fit.policy';
import { getScheduledMealDate } from '@/domain/meal-plan-cycle.policy';
import { getManilaBusinessDateKey } from '@/domain/meal-actionability.policy';
import { getMealSlotCalorieRange } from '@/domain/meal-calorie-allocation.policy';
import { resolveRecipeRiceRole } from '@/domain/recipe-rice-role.policy';
import { scorePreparationCandidate } from '@/domain/upcoming-preparation.policy';
import { resolveReplacementServing, type SwapRiceFood } from './meal-swap-serving.service';
import type { CertifiedLibraryMeal } from './meal-library-candidate-query.service';

/** Candidates have already passed the caller's admission/eligibility query. */
export function selectLibraryMealSlots({
  libraryMeals,
  caseReviewCandidateIds,
  recentlyUsedLibraryIds,
  cookedRiceFood,
  retainedSlots,
  planningTargets,
  dailyCalorieTarget,
  individualReviewRequired,
  profile,
  startDate,
  numDays,
}: {
  libraryMeals: CertifiedLibraryMeal[];
  caseReviewCandidateIds: ReadonlySet<string>;
  recentlyUsedLibraryIds: ReadonlySet<string>;
  cookedRiceFood: SwapRiceFood | null;
  retainedSlots: ReadonlySet<string>;
  planningTargets: PlanningMacroTargets | null;
  dailyCalorieTarget: number;
  individualReviewRequired: boolean;
  profile: Pick<UserProfile, 'dietaryPreference' | 'ricePreference'>;
  startDate: Date;
  numDays: number;
}) {
  const eligibleLibraryMeals = libraryMeals;
  const matchedSlots: {
    dayNumber: number;
    mealType: MealType;
    scheduledDate: Date;
    libraryMeal: (typeof libraryMeals)[0];
    candidateRank: number;
    rankingScore: number;
    rankingReasonCodes: string[];
    pairedRiceG: number | null;
    fallbackAvailable: boolean;
    requiresCaseApproval: boolean;
  }[] = [];

  const unmatchedSlots: {
    dayNumber: number;
    mealType: MealType;
    scheduledDate: Date;
  }[] = [];
  const lastSelectedLibraryDay = new Map<string, number>();
  const selectedNutrition: Array<NutritionVector & { dayNumber: number; mealType: string }> = [];

  // Evaluate each individual slot independently
  for (let day = 0; day < numDays; day++) {
    const scheduledDate = getScheduledMealDate(startDate, day);

    const slots = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
    for (const slotType of slots) {
      if (retainedSlots.has(`${getManilaBusinessDateKey(scheduledDate)}:${slotType}`)) continue;
      const macroTarget = mealMacroBudget(
        planningTargets,
        slotType,
        selectedNutrition.filter((m) => m.dayNumber === day + 1)
      );
      const scoreNutrition = planningSlotNutritionScore(
        planningTargets,
        slotType,
        selectedNutrition.filter((m) => m.dayNumber === day + 1)
      );
      // Filter in-memory verified library matches
      const matches = eligibleLibraryMeals.filter((meal) => {
        const previousDay = lastSelectedLibraryDay.get(meal.id);
        if (previousDay !== undefined && day + 1 - previousDay < 3) return false;
        if (!meal.applicableMealTypes.some((entry) => entry.mealType === slotType)) return false;
        if (caseReviewCandidateIds.has(meal.id) && meal.mealType !== slotType) return false;

        // Dietary preference is a positive classification fact. User goals
        // influence serving allocation and ranking, never reusable diet tags.
        if (profile.dietaryPreference && meal.dietaryTags) {
          const tags = meal.dietaryTags as string[];
          if (!tags.includes(profile.dietaryPreference)) return false;
        }

        return true;
      });

      // A certified base recipe is reusable only when its reviewed serving
      // also fits this user's allocated meal target. Prefer the closest fit;
      // smaller recipes fall through to personalized generation.
      const plateById = new Map(
        matches.map((meal) => [
          meal.id,
          resolveReplacementServing({
            meal,
            mealType: slotType,
            dailyTarget: dailyCalorieTarget,
            ricePreference: profile.ricePreference,
            hasConditions: individualReviewRequired,
            riceFood: cookedRiceFood,
            allowPendingCaseReview: true,
            macroTarget,
            scoreNutrition,
          }),
        ])
      );
      const calorieEligibleMatches = matches.filter((meal) => plateById.get(meal.id));
      const range = getMealSlotCalorieRange(dailyCalorieTarget, slotType);
      const ranked = calorieEligibleMatches
        .map((meal) => ({
          meal,
          ranking: scorePreparationCandidate({
            activeClearanceCoverage: !caseReviewCandidateIds.has(meal.id),
            allergenDeclarationsComplete: true,
            ingredientsResolved: meal.ingredients.every((ingredient) => Boolean(ingredient.foodItemId)),
            nutrientsComplete: [meal.calories, meal.proteinG, meal.carbsG, meal.fatG].every(Number.isFinite),
            dietCompatible: true,
            remainingReviews: caseReviewCandidateIds.has(meal.id) ? 1 : 0,
            calorieDeviationRatio: Math.abs(plateById.get(meal.id)!.calories - range.target) / range.target,
            mealTypeMatch: meal.applicableMealTypes.some((entry) => entry.mealType === slotType),
            ricePreference: profile.ricePreference,
            riceRole: resolveRecipeRiceRole(meal).riceRole,
            riceRoleBasis: resolveRecipeRiceRole(meal).basis,
            riceRoleReviewStatus: meal.riceRoleReviewStatus,
            usedInRecentCycle: recentlyUsedLibraryIds.has(meal.id),
          }),
        }))
        .sort(
          (left, right) =>
            Number(caseReviewCandidateIds.has(left.meal.id)) - Number(caseReviewCandidateIds.has(right.meal.id)) ||
            (scoreNutrition
              ? scoreNutrition(plateById.get(left.meal.id)!) - scoreNutrition(plateById.get(right.meal.id)!)
              : 0) ||
            right.ranking.score - left.ranking.score ||
            left.meal.usageCount - right.meal.usageCount ||
            left.meal.id.localeCompare(right.meal.id)
        );
      // Use a different recipe when one is available. A smaller catalogue can
      // repeat a compatible recipe after two intervening days instead of
      // leaving later slots empty solely because it appeared earlier this week.
      const selected = ranked.find(({ meal }) => !lastSelectedLibraryDay.has(meal.id)) ?? ranked[0];

      if (selected) {
        selectedNutrition.push({ ...plateById.get(selected.meal.id)!, dayNumber: day + 1, mealType: slotType });
        lastSelectedLibraryDay.set(selected.meal.id, day + 1);
        const pairedRiceG = plateById.get(selected.meal.id)?.pairedRiceG ?? null;

        matchedSlots.push({
          dayNumber: day + 1,
          mealType: slotType,
          scheduledDate,
          libraryMeal: selected.meal,
          candidateRank: 1,
          rankingScore: selected.ranking.score,
          rankingReasonCodes: selected.ranking.reasonCodes,
          pairedRiceG,
          fallbackAvailable: ranked.length > 1,
          requiresCaseApproval:
            caseReviewCandidateIds.has(selected.meal.id) || Boolean(pairedRiceG && individualReviewRequired),
        });
      } else {
        unmatchedSlots.push({
          dayNumber: day + 1,
          mealType: slotType,
          scheduledDate,
        });
      }
    }
  }

  return { matchedSlots, unmatchedSlots, selectedNutrition };
}

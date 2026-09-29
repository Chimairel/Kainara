import 'dotenv/config';
import { DietaryPreference, MealType } from '@prisma/client';
import { sourceRawRecipeCandidates } from '../src/services/raw-recipe-candidate.service';

async function main() {
  const dailyCalorieTarget = Number(process.env.CANDIDATE_AUDIT_DAILY_KCAL || 2571);
  if (!Number.isFinite(dailyCalorieTarget) || dailyCalorieTarget <= 0) {
    throw new Error('CANDIDATE_AUDIT_DAILY_KCAL must be positive.');
  }
  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
  const slots = Array.from({ length: 7 }, (_, index) => mealTypes.map((mealType) => ({
    dayNumber: index + 1, mealType,
    scheduledDate: new Date(Date.UTC(2031, 0, index + 1)),
  }))).flat();
  const result = await sourceRawRecipeCandidates({
    slots, dailyCalorieTarget, dietaryPreference: DietaryPreference.OMNIVORE,
    conditions: [], allergens: [], reviewFreeBaseOnly: true,
  });
  console.log(JSON.stringify({
    dailyCalorieTarget, requestedSlots: slots.length,
    matchedSlots: result.meals.length, unmatchedSlots: result.remainingSlots.length,
    distinctSourceRecipes: new Set(result.meals.map((meal) => meal.rawCandidateId)).size,
    adjustedPortions: result.meals.filter((meal) => meal.servingScale !== 1).length,
    demoEstimatesUsed: result.meals.filter((meal) =>
      meal.description.includes('Codex demo nutrition estimate')).length,
    byType: Object.fromEntries(mealTypes.map((type) => [type, {
      matched: result.meals.filter((meal) => meal.mealType === type).length,
      distinct: new Set(result.meals.filter((meal) => meal.mealType === type)
        .map((meal) => meal.rawCandidateId)).size,
    }])),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

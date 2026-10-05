import 'dotenv/config';
import { DietaryPreference, MealType, PrismaClient } from '@prisma/client';
import { sourceRawRecipeCandidates } from '../src/services/raw-recipe-candidate.service';
import { hasDemoNutritionEstimate } from '../src/domain/source-nutrition-estimate.policy';

async function main() {
  const dailyCalorieTarget = Number(process.env.CANDIDATE_AUDIT_DAILY_KCAL || 2571);
  if (!Number.isFinite(dailyCalorieTarget) || dailyCalorieTarget <= 0) {
    throw new Error('CANDIDATE_AUDIT_DAILY_KCAL must be positive.');
  }
  const mealTypes = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
  const slots = Array.from({ length: 7 }, (_, index) =>
    mealTypes.map((mealType) => ({
      dayNumber: index + 1,
      mealType,
      scheduledDate: new Date(Date.UTC(2031, 0, index + 1)),
    }))
  ).flat();
  const result = await sourceRawRecipeCandidates({
    slots,
    dailyCalorieTarget,
    dietaryPreference: DietaryPreference.OMNIVORE,
    conditions: [],
    allergens: [],
    reviewFreeBaseOnly: true,
  });
  const prisma = new PrismaClient();
  let demoEstimatesUsed = 0;
  try {
    const selected = await prisma.rawRecipeCandidate.findMany({
      where: { id: { in: result.meals.map((meal) => meal.rawCandidateId) } },
      select: { id: true, publishedNutrition: true },
    });
    const auditedIds = new Set(
      selected.filter((meal) => hasDemoNutritionEstimate(meal.publishedNutrition)).map((meal) => meal.id)
    );
    demoEstimatesUsed = result.meals.filter((meal) => auditedIds.has(meal.rawCandidateId)).length;
  } finally {
    await prisma.$disconnect();
  }
  console.log(
    JSON.stringify(
      {
        dailyCalorieTarget,
        requestedSlots: slots.length,
        matchedSlots: result.meals.length,
        unmatchedSlots: result.remainingSlots.length,
        distinctSourceRecipes: new Set(result.meals.map((meal) => meal.rawCandidateId)).size,
        adjustedPortions: result.meals.filter((meal) => meal.servingScale !== 1).length,
        demoEstimatesUsed,
        byType: Object.fromEntries(
          mealTypes.map((type) => [
            type,
            {
              matched: result.meals.filter((meal) => meal.mealType === type).length,
              distinct: new Set(
                result.meals.filter((meal) => meal.mealType === type).map((meal) => meal.rawCandidateId)
              ).size,
            },
          ])
        ),
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

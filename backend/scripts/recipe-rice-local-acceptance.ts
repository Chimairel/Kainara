import assert from 'node:assert/strict';
import { getManilaMidnight, getManilaDateKey } from '../src/domain/meal-plan-cycle.policy';
import { randomUUID, createHash } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { createRecipeDerivation } from '../src/services/recipe-derivation.service';
import { MealBaseVerificationService } from '../src/services/meal-base-verification.service';
import { admittedLibraryBaseIds, libraryBaseRevisionKey } from '../src/services/meal-base-admission.service';
import { certifyLibraryMealSafety } from '../src/services/nutritionist-library-certification.service';
import { composePlanWithPairedRice, buildBaseServingPersistence } from '../src/services/meal-plan-serving.service';
import { approveMealPlan } from '../src/services/nutritionist-approval.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { flagWholeMeal, releaseWholeMeal } from '../src/services/meal-wide-flag.service';
import { resolveReplacementServing } from '../src/services/meal-swap-serving.service';
import { certifiedLibraryMealInclude } from '../src/services/meal-library-candidate-query.service';
import { prepareLibraryNutritionEvidence } from '../src/services/nutritionist-library-nutrition-evidence.service';
import { recipeDerivationSchema } from '../src/validation/recipe-derivation.schemas';

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  assert.ok(
    ['127.0.0.1', 'localhost'].includes(database.hostname) && database.pathname === '/recipe_rice_acceptance',
    'Use only the disposable recipe_rice_acceptance database.'
  );
  const run = randomUUID();
  const reviewers = [];
  for (let index = 0; index < 4; index++) {
    reviewers.push(
      await prisma.nutritionistProfile.create({
        data: {
          user: {
            create: {
              name: `Recipe reviewer ${index}`,
              email: `recipe-${run}-${index}@example.invalid`,
              passwordHash: 'disabled',
              role: 'NUTRITIONIST',
              emailVerified: true,
            },
          },
          prcLicenseNumber: `${run}-${index}`,
          prcLicenseExpiry: new Date('2030-12-31'),
          isVerified: true,
          canLeadReview: index === 3,
        },
      })
    );
  }
  const [author, verifier, flagger, lead] = reviewers;
  const food = await prisma.foodItem.create({
    data: { name: 'Tomato', source: 'FNRI', category: 'Vegetables', calories: 100, proteinG: 10, carbsG: 10, fatG: 2 },
  });
  const other = await prisma.foodItem.create({
    data: {
      name: 'Chicken',
      source: 'FNRI',
      category: 'Meat & Poultry',
      calories: 150,
      proteinG: 25,
      carbsG: 0,
      fatG: 4,
    },
  });
  const rice = await prisma.foodItem.create({
    data: { name: 'Rice, well-milled, boiled', source: 'FNRI', calories: 130, proteinG: 2.5, carbsG: 28, fatG: 0.3 },
  });
  const parent = await prisma.mealLibrary.create({
    data: {
      mealName: `Tomato dish ${run}`,
      description: 'Original tomato preparation',
      mealType: 'BREAKFAST',
      calories: 300,
      proteinG: 30,
      carbsG: 30,
      fatG: 6,
      recipeSignature: createHash('sha256').update(run).digest('hex'),
      verifiedByNutritionistId: verifier.id,
      suitableConditions: [],
      allergenFree: [],
      dietaryTags: [],
      ingredients: {
        create: {
          position: 0,
          ingredientName: food.name,
          foodItemId: food.id,
          quantity: 300,
          unit: 'g',
          category: food.category,
          dataSource: 'FNRI',
        },
      },
    },
  });
  await prisma.mealBaseVerification.create({
    data: {
      targetKind: 'LIBRARY_MEAL',
      targetId: parent.id,
      revisionKey: libraryBaseRevisionKey(parent.recipeSignature!, parent.description),
      status: 'VERIFIED',
    },
  });
  const input = recipeDerivationSchema.parse({
    expectedRevision: 0,
    mealName: parent.mealName,
    summary: 'Measured tomato serving',
    instructions: 'Cook the tomato until tender and serve warm.',
    mealType: 'BREAKFAST',
    ingredients: [{ foodItemId: food.id, grams: 400 }],
    riceRole: 'PAIR_WITH_RICE',
    riceMinHalfCups: 1,
    riceMaxHalfCups: 3,
    imageUrl: null,
    imageMatchesRecipe: true,
    rationale: 'Increase measured tomato portion for a complete plate.',
  });
  const serving = await createRecipeDerivation(author.id, parent.id, input);
  assert.equal(serving.derivationKind, 'SERVING_VERSION');
  assert.equal(serving.recipeFamilyId, parent.id);
  assert.equal(serving.sourceRawRecipeCandidateId, null);
  assert.equal(serving.safetyEvidenceStatus, 'INCOMPLETE');
  assert.equal((await admittedLibraryBaseIds([serving])).size, 0);
  assert.equal(await prisma.mealLibraryProfileApproval.count({ where: { mealLibraryId: serving.id } }), 0);
  assert.deepEqual(await prisma.mealLibrary.findUnique({ where: { id: parent.id } }), parent);
  await assert.rejects(
    MealBaseVerificationService.claim(author.id, 'LIBRARY_MEAL', serving.id),
    /different nutritionist/
  );
  await MealBaseVerificationService.claim(verifier.id, 'LIBRARY_MEAL', serving.id);
  await MealBaseVerificationService.decide(
    verifier.id,
    'LIBRARY_MEAL',
    serving.id,
    'VERIFIED',
    'Reviewed measured ingredients, instructions and rice pairing limits.'
  );
  const certification = {
    expectedRevision: 1,
    conditionDeclarationState: 'NOT_REVIEWED' as const,
    allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS' as const,
    crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK' as const,
    suitableConditions: [],
    allergensPresent: [],
    allergensReviewedAbsent: ['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN', 'EGGS'],
    usdaUseAccepted: false,
  };
  await assert.rejects(certifyLibraryMealSafety(author.id, serving.id, certification), /different nutritionist/);
  await certifyLibraryMealSafety(verifier.id, serving.id, certification);
  const reviewed = await prisma.mealLibrary.findUniqueOrThrow({
    where: { id: serving.id },
    include: certifiedLibraryMealInclude,
  });
  const plate = resolveReplacementServing({
    meal: reviewed,
    mealType: 'BREAKFAST',
    dailyTarget: 2000,
    ricePreference: 'WITH_RICE',
    hasConditions: false,
    riceFood: rice,
  });
  assert.equal(plate?.pairedRiceG, 150);
  assert.equal(plate?.calories, 595);
  const alreadyIncludesRice = resolveReplacementServing({
    meal: { ...reviewed, riceRole: 'INCLUDES_RICE', includedRiceG: 150, calories: 600 },
    mealType: 'BREAKFAST',
    dailyTarget: 2000,
    ricePreference: 'WITH_RICE',
    hasConditions: false,
    riceFood: rice,
  });
  assert.equal(alreadyIncludesRice?.pairedRiceG, null);
  assert.equal(alreadyIncludesRice?.calories, 600);

  assert.equal(
    resolveReplacementServing({
      meal: reviewed,
      mealType: 'BREAKFAST',
      dailyTarget: 2000,
      ricePreference: 'WITH_RICE',
      hasConditions: true,
      riceFood: rice,
    }),
    null
  );
  await assert.rejects(
    prepareLibraryNutritionEvidence(verifier.id, serving.id, {
      expectedRevision: reviewed.safetyEvidenceRevision,
      portionBasis: 'Measured edible amount for one serving',
      ingredients: reviewed.ingredients.map((item) => ({
        id: item.id,
        foodItemId: item.foodItemId!,
        gramsPerServing: 500,
      })),
    }),
    /new recipe draft/
  );
  const adapted = await createRecipeDerivation(author.id, parent.id, {
    ...input,
    mealName: `Chicken adaptation ${run}`,
    ingredients: [{ foodItemId: other.id, grams: 250 }],
    imageUrl: 'https://example.com/chicken.jpg',
  });
  assert.equal(adapted.derivationKind, 'ADAPTED');
  assert.equal(adapted.recipeFamilyId, null);
  assert.equal((await admittedLibraryBaseIds([adapted])).size, 0);
  assert.ok(
    await prisma.notification.findFirst({
      where: { userId: verifier.userId, title: 'Recipe awaiting independent review' },
    })
  );
  const user = await prisma.user.create({
    data: {
      name: 'Rice plate tester',
      email: `plate-${run}@example.invalid`,
      passwordHash: 'disabled',
      onboardingDone: true,
      emailVerified: true,
      userProfile: { create: { dailyCalorieTarget: 2000, dietaryPreference: 'OMNIVORE' } },
      safetyProfileEntries: {
        create: ['CONDITION', 'ALLERGY'].map((domain) => ({
          domain: domain as 'CONDITION' | 'ALLERGY',
          canonicalCode: 'NONE',
          displayName: 'None',
          originalText: 'None',
          normalizedText: 'none',
          provenance: 'PREDEFINED' as const,
          supportState: 'SUPPORTED' as const,
          policyReference: 'acceptance',
        })),
      },
    },
  });
  const now = new Date();
  const cycle = await prisma.mealPlanCycle.create({
    data: {
      id: `recipe-${run}`,
      userId: user.id,
      planType: 'WEEKLY',
      startDate: getManilaMidnight(getManilaDateKey(now)),
      endDate: new Date(now.getTime() + 86400000 * 7),
      preparationOpensAt: now,
      shoppingDeadlineAt: now,
      expectedSlotCount: 1,
      status: 'UNDER_REVIEW',
    },
  });
  const plan = await prisma.mealPlan.create({
    data: {
      userId: user.id,
      planGroupId: cycle.id,
      libraryMealId: reviewed.id,
      mealName: reviewed.mealName,
      description: reviewed.description,
      mealType: 'BREAKFAST',
      calories: reviewed.calories,
      proteinG: reviewed.proteinG,
      carbsG: reviewed.carbsG,
      fatG: reviewed.fatG,
      scheduledDate: now,
      claimedByNutritionistId: verifier.id,
      claimedAt: now,
      candidateProvenance: 'CERTIFIED_LIBRARY',
      ingredients: {
        create: reviewed.ingredients.map(({ ingredientName, category, foodItemId, quantity, unit, dataSource }) => ({
          ingredientName,
          category,
          foodItemId,
          quantity,
          unit,
          dataSource,
        })),
      },
      ...buildBaseServingPersistence({
        ...reviewed,
        ingredients: reviewed.ingredients,
        evidenceSource: 'CERTIFIED_LIBRARY',
      }),
    },
  });
  await assert.rejects(
    prisma.$transaction((tx) =>
      composePlanWithPairedRice(tx, { mealPlanId: plan.id, cookedRiceG: 37.5, fnriRiceFoodItemId: rice.id })
    ),
    /half-cup/
  );
  await prisma.$transaction((tx) =>
    composePlanWithPairedRice(tx, { mealPlanId: plan.id, cookedRiceG: 150, fnriRiceFoodItemId: rice.id })
  );
  const before = await prisma.mealPlan.findUniqueOrThrow({
    where: { id: plan.id },
    include: { ingredients: true, servingComponents: true },
  });
  await assert.rejects(approveMealPlan(verifier.id, plan.id, undefined, { calories: 600 }), /saved recipe unchanged/);
  await approveMealPlan(verifier.id, plan.id);
  const after = await prisma.mealPlan.findUniqueOrThrow({
    where: { id: plan.id },
    include: { ingredients: true, servingComponents: true },
  });
  const groceries = await prisma.groceryList.findFirstOrThrow({
    where: { userId: user.id, planGroupId: cycle.id },
    include: { groceryItems: true },
  });
  assert.ok(
    groceries.groceryItems.some(
      (item) => item.ingredientName === rice.name && item.quantity === 150 && item.unit === 'g'
    )
  );
  assert.equal(after.calories, 595);
  assert.deepEqual(after.ingredients, before.ingredients);
  assert.deepEqual(after.servingComponents, before.servingComponents);
  assert.equal(after.composedServingSignature, before.composedServingSignature);
  assert.ok((await MealPlanCycleService.getClearedMealPlanIds(user.id, cycle.id)).includes(plan.id));
  await prisma.foodItem.update({ where: { id: rice.id }, data: { compositionRevision: { increment: 1 } } });
  assert.equal((await MealPlanCycleService.getClearedMealPlanIds(user.id, cycle.id)).includes(plan.id), false);
  // A child without a raw-source link still resolves all legacy siblings and their children.
  const raw = await prisma.rawRecipeCandidate.create({
    data: {
      sourceRecordId: `family-${run}`,
      sourceUrl: 'https://panlasangpinoy.com/example/',
      recipeName: parent.mealName,
      normalizedName: `family-${run}`,
      contentSignature: createHash('sha256').update(`raw-${run}`).digest('hex'),
      cuisines: [],
      dietaryTags: [],
      ingredients: [],
      mealType: 'BREAKFAST',
    },
  });
  await prisma.mealLibrary.update({ where: { id: parent.id }, data: { sourceRawRecipeCandidateId: raw.id } });
  const sibling = await prisma.mealLibrary.create({
    data: {
      mealName: `Legacy serving ${run}`,
      mealType: 'BREAKFAST',
      calories: 350,
      proteinG: 35,
      carbsG: 35,
      fatG: 7,
      sourceRawRecipeCandidateId: raw.id,
      recipeSignature: createHash('sha256').update(`sibling-${run}`).digest('hex'),
      suitableConditions: [],
      allergenFree: [],
      dietaryTags: [],
      verifiedByNutritionistId: verifier.id,
    },
  });
  const siblingChild = await prisma.mealLibrary.create({
    data: {
      mealName: `Legacy child ${run}`,
      mealType: 'BREAKFAST',
      calories: 375,
      proteinG: 35,
      carbsG: 35,
      fatG: 7,
      parentMealId: sibling.id,
      recipeFamilyId: sibling.id,
      derivationKind: 'SERVING_VERSION',
      recipeSignature: createHash('sha256').update(`child-${run}`).digest('hex'),
      suitableConditions: [],
      allergenFree: [],
      dietaryTags: [],
      verifiedByNutritionistId: verifier.id,
    },
  });
  await flagWholeMeal(flagger.id, serving.id, 'Investigate the recorded tomato preparation and its serving variants.');
  assert.equal((await prisma.mealLibrary.findUniqueOrThrow({ where: { id: siblingChild.id } })).status, 'FLAGGED');
  const corrected = await createRecipeDerivation(author.id, parent.id, {
    ...input,
    ingredients: [{ foodItemId: food.id, grams: 410 }],
  });
  assert.equal(corrected.status, 'APPROVED');
  assert.equal((await admittedLibraryBaseIds([corrected])).size, 0);

  await assert.rejects(
    releaseWholeMeal(verifier.id, serving.id, 'Original verification was complete.'),
    /uninvolved Lead/
  );
  await releaseWholeMeal(
    lead.id,
    serving.id,
    'Independent review confirms the unchanged recorded preparation is valid.'
  );
  assert.equal((await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } })).requiresSafetyRevalidation, true);
  console.log(
    'PASS: immutable drafts, independent review, certification, whole-plate rice, approval preservation, stale food rejection, family flag and uninvolved Lead resolution.'
  );
}
main()
  .finally(() => prisma.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

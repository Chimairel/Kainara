/** Read-only catalogue inspection. No accounts, generation jobs, certification or provider calls. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DietaryPreference, MealType, Prisma, PrismaClient, RicePreference } from '@prisma/client';
import {
  classifyMealIngredients,
  hasDefiniteDietaryConflict,
} from '../src/domain/meal-ingredient-classification.policy';
import {
  CONDITION_SAFETY_CATALOGUE,
  FOOD_SAFETY_CATALOGUE,
  resolveSafetyEntries,
} from '../src/domain/safety-intake.policy';
import { effectiveRecipeMealTypes } from '../src/domain/meal-applicability.policy';
import { evaluateMealLibrarySafetyEvidence } from '../src/domain/meal-library-safety-evidence.policy';
import { isNutritionistEligibleForReview } from '../src/domain/nutritionist-review.policy';
import { hasDemoNutritionEstimate } from '../src/domain/source-nutrition-estimate.policy';
import { projectRawRecipeCandidate } from '../src/services/panlasang-recipe-candidate.provider';
import { rawRecipeServing } from '../src/services/raw-recipe-serving.service';
import {
  certifiedLibraryMealInclude,
  isCertifiedLibraryMealCompatible,
  isProfileApprovedLibraryMealCompatible,
} from '../src/services/meal-library-candidate-query.service';
import { baseMealAdmissionMatches } from '../src/services/meal-base-admission.service';
import { resolveReplacementServing } from '../src/services/meal-swap-serving.service';

type Case = {
  key: string;
  label: string;
  group: 'ORIGINAL_17' | 'CATALOGUE' | 'INTERSECTION';
  conditions: string[];
  foods: string[];
  diet: DietaryPreference;
  rice: RicePreference;
  unresolved?: boolean;
};
const types = [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER];
const targets = [1800, 2400, 2800];
const foodKeys = ['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN', 'EGGS'];

function cases(): Case[] {
  const rows: Case[] = [];
  const add = (key: string, label: string, extra: Partial<Case> = {}) =>
    rows.push({
      key,
      label,
      group: 'ORIGINAL_17',
      conditions: [],
      foods: [],
      diet: 'OMNIVORE',
      rice: 'FLEXIBLE',
      ...extra,
    });
  add('none', 'No restrictions');
  add('shellfish', 'Shellfish allergy', { foods: ['SHELLFISH'] });
  add('multi-allergy', 'Nuts + eggs + dairy', { foods: ['NUTS', 'EGGS', 'DAIRY'] });
  add('diabetes', 'Diabetes', { conditions: ['DIABETES'] });
  add('hypertension', 'Hypertension', { conditions: ['HYPERTENSION'] });
  add('kidney-shellfish', 'Kidney disease + shellfish', { conditions: ['KIDNEY_DISEASE'], foods: ['SHELLFISH'] });
  add('heart-nuts-msg', 'Heart condition + nuts + MSG', { conditions: ['HEART_CONDITION'], foods: ['NUTS', 'MSG'] });
  add('pregnant', 'Pregnant/lactating', { conditions: ['PREGNANT'] });
  add('gout', 'Gout', { conditions: ['GOUT'] });
  add('unknown', 'Unknown condition + allergy', { unresolved: true });
  add('pollen', 'Pollen allergy', { unresolved: true });
  add('non-food', 'Myopia + dust mites', { unresolved: true });
  add('intolerance', 'Lactose intolerance + avoided pork', { foods: ['LACTOSE', 'PORK'] });
  add('vegan', 'Vegan', { diet: 'VEGAN' });
  add('vegetarian', 'Vegetarian', { diet: 'VEGETARIAN' });
  add('pescatarian', 'Pescatarian + no rice', { diet: 'PESCATARIAN', rice: 'NO_RICE' });
  add('shellfish-gluten', 'Shellfish + gluten', { foods: ['SHELLFISH', 'GLUTEN'] });
  for (const item of CONDITION_SAFETY_CATALOGUE.filter((item) => item.code !== 'NONE'))
    add(`condition-${item.code}`, item.displayName, { group: 'CATALOGUE', conditions: [item.code] });
  for (const item of FOOD_SAFETY_CATALOGUE.filter((item) => item.code !== 'NONE'))
    add(`food-${item.code}`, item.displayName, { group: 'CATALOGUE', foods: [item.code] });
  for (const diet of Object.values(DietaryPreference)) {
    for (let mask = 0; mask < 32; mask++) {
      const foods = foodKeys.filter((_, index) => mask & (1 << index));
      add(`intersection-${diet}-${mask}`, `${diet} + ${foods.join(' + ') || 'no allergy'}`, {
        group: 'INTERSECTION',
        diet,
        foods,
      });
    }
  }
  return rows;
}

/** Extra conservative shortlist flags; they confer no clinical/allergen authority. */
function inspectIngredients(names: string[], title = '') {
  const classification = classifyMealIngredients(names.map((name) => ({ name })));
  const text = names.join(' | ').normalize('NFKC').toLowerCase();
  const detected = new Set<string>(classification.detectedAllergens);
  const patterns: Record<string, RegExp> = {
    SHELLFISH:
      /\b(?:shrimps?|prawns?|crabs?|lobsters?|crayfish|mussels?|oysters?|scallops?|clams?|squids?|octop(?:us|uses)|hipon|alamang|tahong|talaba)\b/u,
    NUTS: /\b(?:peanuts?|almonds?|cashews?|walnuts?|hazelnuts?|pistachios?|pecans?|macadamias?|mani|kasuy)\b/u,
    GLUTEN: /\b(?:wheat|barley|rye|breadcrumbs?|bread crumbs?|panko|soy sauce|patis with wheat)\b/u,
    EGGS: /\b(?:eggs?|mayonnaise|mayo|itlog|balut|penoy)\b/u,
    SOY: /\b(?:soy|soya|soybean|soybeans|tofu|tokwa|miso|tempeh|taho)\b/u,
    FISH: /\b(?:fish|tuna|salmon|tilapia|bangus|galunggong|sardines?|anchov(?:y|ies)|patis|danggit|dilis|cod|haddock|mackerel|bonito|daing|bacalao)\b/u,
    SESAME: /\b(?:sesame|tahini|linga)\b/u,
    MSG: /\b(?:msg|monosodium glutamate|ajinomoto|vetsin)\b/u,
    PORK: /\b(?:pork|baboy|bacon|ham|lard|prosciutto|pancetta|chorizo|longgani[sz]a|tocino|liempo|pata)\b/u,
    BEEF: /\b(?:beef|baka|veal|oxtail)\b/u,
    DAIRY: /\b(?:cheddar|mozzarella|parmesan|paneer|ghee|buttermilk|creamer)\b/u,
  };
  for (const [key, pattern] of Object.entries(patterns)) if (pattern.test(text)) detected.add(key);
  if (detected.has('DAIRY')) detected.add('LACTOSE');
  const uncertain = names.filter(
    (name) =>
      /\b(?:seasoning|bouillon|cube|powder|mix|stock|broth|bagoong|sauce|margarine|shortening|spread|chocolate|sausage|hotdog|corned beef|deli ham|ketchup|catsup)\b/iu.test(
        name
      ) && !/\b(?:water|sugar|salt|black pepper)\b/iu.test(name)
  );
  const titleAllergens = classifyMealIngredients([{ name: title }]).detectedAllergens;
  // A noodle/pasta title alone does not establish wheat: rice/glass alternatives are valid.
  const titleMissing = titleAllergens.filter((allergen) => allergen !== 'GLUTEN' && !detected.has(allergen));
  if (/\b(?:omele(?:t|tte)|tortang|silog)\b/iu.test(title) && !detected.has('EGGS')) titleMissing.push('EGGS');
  const auditHolds = [...new Set(titleMissing)].map((allergen) => `TITLE_${allergen}_INGREDIENT_MISSING`);
  if (
    /\b(?:marinade|dipping sauce|toasted garlic|caramelize onions|roasted pumpkin seeds|home fries|carioca|binatog|ginataang mais)\b/iu.test(
      title
    )
  )
    auditHolds.push('SIDE_SNACK_OR_COMPONENT_NEEDS_MAIN_MEAL_COMPOSITION');
  return { classification, detected: [...detected].sort(), uncertain: [...new Set(uncertain)], auditHolds };
}

function countTypes<T>(items: readonly T[], getTypes: (item: T) => readonly MealType[]) {
  return Object.fromEntries(types.map((type) => [type, items.filter((item) => getTypes(item).includes(type)).length]));
}
function jsonStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
function groupCounts(values: string[]) {
  return Object.fromEntries(
    [...new Set(values)].sort().map((key) => [key, values.filter((value) => value === key).length])
  );
}
const showCounts = (counts: Record<string, number>) => types.map((type) => counts[type]).join(' / ');
const escape = (value: string) => value.replace(/\|/g, '/').replace(/[\r\n]/g, ' ');

async function main() {
  assert.equal(process.env.CATALOGUE_AUDIT_READ_ONLY, 'true', 'Explicit read-only audit opt-in is required.');
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, 'ep-crimson-poetry-ao0sqrvy-pooler.c-2.ap-southeast-1.aws.neon.tech');
  assert.equal(target.pathname, '/neondb');
  const db = new PrismaClient({ log: ['error'] });
  try {
    // Every database query belongs to the same enforced read-only consistent snapshot.
    const snapshot = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        const guard = await tx.$queryRaw<
          Array<{ mode: string }>
        >`SELECT current_setting('transaction_read_only') AS mode`;
        assert.equal(guard[0].mode, 'on');
        const raw = await tx.rawRecipeCandidate.findMany({
          include: { applicableMealTypes: true, libraryVariants: { select: { status: true } } },
          orderBy: [{ recipeName: 'asc' }, { id: 'asc' }],
        });
        const library = await tx.mealLibrary.findMany({
          include: { ...certifiedLibraryMealInclude, flags: { select: { status: true } } },
          orderBy: [{ mealName: 'asc' }, { id: 'asc' }],
        });
        const foods = await tx.foodItem.findMany({
          select: {
            id: true,
            name: true,
            category: true,
            source: true,
            compositionRevision: true,
            calories: true,
            proteinG: true,
            carbsG: true,
            fatG: true,
          },
        });
        const verification = await tx.mealBaseVerification.findMany({
          where: { status: 'VERIFIED' },
          select: { targetKind: true, targetId: true, revisionKey: true },
        });
        const rulePolicies = await tx.conditionRulePolicyVersion.findMany({
          select: { condition: true, state: true, policyVersion: true, automationAllowed: true },
        });
        const nutrientRules = await tx.conditionNutrientRule.findMany({
          select: {
            condition: true,
            nutrient: true,
            active: true,
            reviewStatus: true,
            basis: true,
            evidenceSource: { select: { state: true } },
          },
        });
        return { raw, library, foods, verification, rulePolicies, nutrientRules, readOnly: guard[0].mode };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 120_000, maxWait: 15_000 }
    );
    await db.$disconnect();
    const foodMap = new Map(snapshot.foods.map((food) => [food.id, food]));
    const riceFood =
      snapshot.foods.find(
        (food) => food.source === 'FNRI' && food.name.toLowerCase() === 'rice, well-milled, boiled'
      ) ?? null;
    const raw = snapshot.raw.map((row) => {
      const meal = projectRawRecipeCandidate(row);
      const names = meal.ingredients.flatMap((ingredient) => [
        ingredient.name,
        ...(ingredient.foodItemId && foodMap.get(ingredient.foodItemId)
          ? [foodMap.get(ingredient.foodItemId)!.name]
          : []),
      ]);
      return {
        row,
        meal,
        screening: inspectIngredients(names, meal.displayName),
        flagged: row.libraryVariants.some((variant) => variant.status === 'FLAGGED'),
        estimated: hasDemoNutritionEstimate(row.publishedNutrition),
      };
    });
    const verificationKeys = new Set(
      snapshot.verification.map((row) => `${row.targetKind}:${row.targetId}:${row.revisionKey}`)
    );
    const library = snapshot.library.map((meal) => ({
      meal,
      screening: inspectIngredients(
        meal.ingredients.flatMap((ingredient) => [
          ingredient.ingredientName,
          ...(ingredient.foodItem?.name ? [ingredient.foodItem.name] : []),
        ]),
        meal.mealName
      ),
      admitted: baseMealAdmissionMatches(meal, verificationKeys),
      types: effectiveRecipeMealTypes(
        meal.mealName,
        null,
        meal.applicableMealTypes.map((type) => type.mealType)
      ),
      evidence: evaluateMealLibrarySafetyEvidence({
        ...meal,
        reviewerEligible: meal.safetyReviewedByNutritionist
          ? isNutritionistEligibleForReview(meal.safetyReviewedByNutritionist)
          : false,
      }),
      flagged: meal.status === 'FLAGGED' || meal.flags.some((flag) => flag.status === 'PENDING'),
    }));
    const fitCache = new Map<string, MealType[]>();
    const rawTypesAt = (item: (typeof raw)[number], calories: number, rice: RicePreference) => {
      const key = `${item.meal.id}:${calories}:${rice}`;
      if (!fitCache.has(key))
        fitCache.set(
          key,
          types.filter(
            (mealType) =>
              rawRecipeServing({
                candidate: item.meal,
                mealType,
                dailyCalorieTarget: calories,
                ricePreference: rice,
                riceFood,
              }) !== null
          )
        );
      return fitCache.get(key)!;
    };
    const results = cases().map((scenario) => {
      const compatible = (screening: ReturnType<typeof inspectIngredients>, tags: string[]) =>
        !scenario.unresolved &&
        tags.includes(scenario.diet) &&
        !hasDefiniteDietaryConflict(screening.classification, scenario.diet) &&
        !scenario.foods.some((food) => screening.detected.includes(food));
      const candidates = raw.filter(
        (item) =>
          item.meal.state === 'ACTIVE' &&
          !item.flagged &&
          Boolean(item.meal.nutrition && item.meal.ingredients.length) &&
          compatible(item.screening, item.meal.dietaryTags)
      );
      const strict = candidates.filter(
        (item) =>
          item.screening.classification.status === 'COMPLETE' &&
          !item.screening.auditHolds.length &&
          (!scenario.foods.length || !item.screening.uncertain.length)
      );
      const reviewedCandidates = library.filter(
        (item) =>
          item.meal.status === 'APPROVED' &&
          !item.flagged &&
          item.admitted &&
          compatible(item.screening, jsonStrings(item.meal.dietaryTags))
      );
      const entryInputs = [
        ...scenario.conditions.map((value) => ({
          domain: 'CONDITION' as const,
          value,
          provenance: 'PREDEFINED' as const,
        })),
        ...scenario.foods.map((value) => ({
          domain:
            value === 'LACTOSE' || value === 'MSG'
              ? ('INTOLERANCE' as const)
              : value === 'PORK' || value === 'BEEF'
                ? ('AVOIDED_INGREDIENT' as const)
                : ('ALLERGY' as const),
          value,
          provenance: 'PREDEFINED' as const,
        })),
      ];
      const safetyEntries = resolveSafetyEntries(entryInputs);
      const profile = { dietaryPreference: scenario.diet, otherConditions: null, otherAllergies: null, safetyEntries };
      const reusable = reviewedCandidates.filter(
        (item) =>
          !scenario.unresolved &&
          (isCertifiedLibraryMealCompatible(item.meal, scenario.conditions, scenario.foods, profile) ||
            isProfileApprovedLibraryMealCompatible(item.meal, scenario.conditions, scenario.foods, profile))
      );
      const fitted = strict.filter((item) => rawTypesAt(item, 2800, scenario.rice).length);
      const shortlist = Object.fromEntries(
        types.map((type) => [
          type,
          fitted
            .filter((item) => rawTypesAt(item, 2800, scenario.rice).includes(type))
            .sort(
              (a, b) =>
                Number(a.estimated) - Number(b.estimated) ||
                Number(!a.meal.ingredientsComplete) - Number(!b.meal.ingredientsComplete) ||
                a.screening.uncertain.length - b.screening.uncertain.length ||
                a.meal.ingredients.length - b.meal.ingredients.length ||
                a.meal.displayName.localeCompare(b.meal.displayName)
            )
            .slice(0, 7)
            .map((item) => item.meal.id),
        ])
      );
      return {
        ...scenario,
        interpretation: scenario.unresolved
          ? 'CLARIFY_SCOPE_FIRST'
          : scenario.conditions.length || scenario.foods.some((food) => !foodKeys.includes(food))
            ? 'INGREDIENT_SCREENED_REVIEW_CANDIDATES_NOT_CONDITION_CLEARANCE'
            : 'INGREDIENT_SCREENED_CANDIDATES_NOT_ALLERGEN_CERTIFICATION',
        rawCandidateCount: candidates.length,
        rawConservativeCount: strict.length,
        rawCandidateIds: candidates.map((item) => item.meal.id),
        rawConservativeIds: strict.map((item) => item.meal.id),
        rawByType: countTypes(candidates, (item) => item.meal.applicableMealTypes),
        conservativeServingCounts: Object.fromEntries(
          targets.map((calories) => [calories, countTypes(strict, (item) => rawTypesAt(item, calories, scenario.rice))])
        ),
        reviewedIngredientCandidateCount: reviewedCandidates.length,
        reusableLibraryCount: reusable.length,
        reusableLibraryIds: reusable.map((item) => item.meal.id),
        reusableLibraryByType: countTypes(reusable, (item) => item.types),
        reusableLibraryServingCounts: countTypes(reusable, (item) =>
          types.filter(
            (mealType) =>
              resolveReplacementServing({
                meal: item.meal,
                mealType,
                dailyTarget: 2800,
                ricePreference: scenario.rice,
                hasConditions: scenario.conditions.length > 0,
                riceFood,
              }) !== null
          )
        ),
        shortlist,
      };
    });
    const allMeals = raw.map((item) => ({
      id: item.meal.id,
      name: item.meal.displayName,
      sourceUrl: item.meal.sourceUrl,
      status: item.row.status,
      types: item.meal.applicableMealTypes,
      dietTags: item.meal.dietaryTags,
      riceRole: item.meal.riceRole,
      nutrition: item.meal.nutrition,
      estimatedNutrition: item.estimated,
      ingredients: item.meal.ingredients,
      ingredientScreen: {
        detected: item.screening.detected,
        unknown: item.screening.classification.unknownIngredients,
        uncertain: item.screening.uncertain,
        auditHolds: item.screening.auditHolds,
      },
      flagged: item.flagged,
      conservativeCases: results
        .filter((result) => result.rawConservativeIds.includes(item.meal.id))
        .map((result) => result.key),
    }));
    const libraryMeals = library.map((item) => ({
      id: item.meal.id,
      name: item.meal.mealName,
      status: item.meal.status,
      types: item.types,
      admitted: item.admitted,
      flagged: item.flagged,
      evidenceComplete: item.evidence.complete,
      evidenceReasons: item.evidence.reasons,
      coverageReasons: item.evidence.coverageReasons,
      reviewedAbsentAllergens: item.evidence.allergenFree,
      extendedNutrients: Object.fromEntries(
        ['sodiumMg', 'sugarG', 'fiberG', 'potassiumMg', 'phosphorusMg', 'saturatedFatG'].map((field) => [
          field,
          item.meal[field as keyof typeof item.meal],
        ])
      ),
    }));
    const inventory = {
      rawRows: raw.length,
      rawStatuses: groupCounts(raw.map((item) => item.row.status)),
      rawSources: groupCounts(raw.map((item) => item.row.sourceName)),
      rawFlagged: raw.filter((item) => item.flagged).length,
      rawNutritionMissing: raw.filter((item) => !item.meal.nutrition).length,
      rawNutritionEstimated: raw.filter((item) => item.estimated).length,
      rawUnmeasuredIngredients: raw.filter((item) => !item.meal.ingredientsComplete).length,
      rawClassificationUnknown: raw.filter((item) => item.screening.classification.status !== 'COMPLETE').length,
      rawAuditHoldCounts: groupCounts(raw.flatMap((item) => item.screening.auditHolds)),
      rawByType: countTypes(raw, (item) => item.meal.applicableMealTypes),
      libraryRows: library.length,
      libraryStatuses: groupCounts(library.map((item) => item.meal.status)),
      libraryBaseComplete: library.filter((item) => item.admitted && !item.flagged && item.evidence.complete).length,
      libraryEvidenceReasons: groupCounts(library.flatMap((item) => item.evidence.reasons)),
      libraryMissingNutrients: Object.fromEntries(
        ['sodiumMg', 'sugarG', 'fiberG', 'potassiumMg', 'phosphorusMg', 'saturatedFatG'].map((field) => [
          field,
          library.filter((item) => item.meal[field as keyof typeof item.meal] === null).length,
        ])
      ),
      activeRulePolicies: snapshot.rulePolicies.filter((rule) => rule.state === 'ACTIVE'),
      activeApprovedNutrientRuleCounts: groupCounts(
        snapshot.nutrientRules
          .filter((rule) => rule.active && rule.reviewStatus === 'APPROVED' && rule.evidenceSource?.state === 'CURRENT')
          .map((rule) => rule.condition)
      ),
    };
    const root = path.resolve('..');
    const artifactDirectory = path.join(root, '.codex-runtime/catalogue-coverage');
    await mkdir(artifactDirectory, { recursive: true });
    const capturedAt = new Date().toISOString();
    const revision = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    await writeFile(
      path.join(artifactDirectory, 'coverage.json'),
      JSON.stringify(
        {
          capturedAt,
          revision,
          readOnly: snapshot.readOnly,
          inventory,
          cases: results,
          recipes: allMeals,
          reviewedLibrary: libraryMeals,
        },
        null,
        2
      )
    );
    const byId = new Map(allMeals.map((meal) => [meal.id, meal]));
    const table = (selected: typeof results) => [
      '| Case | Raw ingredient candidates | Conservative candidates | Conservative B / L / D at 2,800 kcal | Reusable reviewed recipes |',
      '| --- | ---: | ---: | --- | ---: |',
      ...selected.map(
        (row) =>
          `| ${escape(row.label)} | ${row.rawCandidateCount} | ${row.rawConservativeCount} | ${showCounts(row.conservativeServingCounts[2800])} | ${row.reusableLibraryCount} |`
      ),
    ];
    const report = [
      '# Whole-catalogue candidate coverage — October 6, 2026',
      '',
      `Snapshot: ${capturedAt}; base commit ${revision}, using the current worktree catalogue policies (including local repairs, if present). All database reads executed inside one PostgreSQL REPEATABLE READ / READ ONLY transaction; read-only mode was verified as on. No accounts, plans, approvals, recipe changes or Gemini calls were made by this scan.`,
      '',
      '## Scope and counting',
      '',
      `Scanned every persisted RawRecipeCandidate (${raw.length}) and MealLibrary row (${library.length}), including excluded/flagged rows in the inventory. Evaluated ${results.length} cases: the original 17, every listed condition/food restriction, and all 32 subsets of the five supported food allergens across all four diets.`,
      '',
      '- Raw ingredient candidates have active source, usable macros/ingredients, matching stored diet tags and no detected ingredient conflict. This is a screening pool, not a clinical recommendation or certification.',
      '- Conservative candidates additionally have complete deterministic ingredient classification and no audit hold for missing title-implied allergens or a side/snack/component misclassified as a main meal. Food-restricted shortlists omit ambiguous packaged/seasoning/sauce/broth ingredients needing label and cross-contact review. A linked FNRI name helps detect conflicts; it does not establish allergen absence. These audit holds do not modify production eligibility.',
      '- B / L / D columns apply the actual pure serving/rice composer to all conservative candidates at an illustrative 2,800 kcal daily target. The JSON also covers 1,800 and 2,400 kcal. These are counts of distinct compatible recipes per slot, not a generated, personalized or clinically cleared seven-day plan.',
      '- Reusable reviewed recipes require current stored admission/evidence and actual library compatibility predicates. No synthetic reviewer or approval is introduced. Condition/user-scoped clearance cannot be inferred for an unspecified member. This count is before calorie/rice fit; JSON supplies fit counts.',
      '- Condition candidate pools are screened for their declared food/diet exclusions only. They are not condition-specific suitability findings. Conditions need current user context, extended nutrients and qualified review.',
      '- Unknown/pollen/myopia/dust cases have no defined supported food scope, so no candidates are claimed until clarification. Zero here denotes undefined scope rather than catalogue exhaustion.',
      '',
      '## Inventory',
      '',
      '```json',
      JSON.stringify(inventory, null, 2),
      '```',
      '',
      '## Findings from the catalogue inspection',
      '',
      '- There are ingredient-level candidates for supported food restriction profiles, but source volume alone does not establish reviewed or full-week coverage. Breakfast and dinner variety is particularly limited for plant-based combinations.',
      '- The stored MealLibrary APPROVED enum is not reusable certification. The current snapshot has zero rows satisfying complete, admitted, unflagged base evidence; every case consequently has zero reusable reviewed library recipes in this scan. Unrestricted raw-source eligibility is a separate path and can still function.',
      '- 1,100 raw recipes carry explicit demo nutrition estimates. Many quantities and ingredient identities need reconciliation. Condition-specific clinical suitability cannot be inferred from these values.',
      '- No active rule policies/current approved nutrient rules were present, and every reviewed-library row lacked phosphorus evidence. Condition candidate counts below mean food/diet-filtered review pools, not condition-suitable meals.',
      '- Source spot-check identified eggs misparsed as a measurement unit in Eggplant and Ground Chicken Omelet. The source-backed repair restores the actual food token and retains the original per-serving quantity. Repair evidence is in `docs/MEAL_CATALOGUE_REPAIRS_2026-10-06.md`. [Original recipe](https://panlasangpinoy.com/eggplant-and-ground-chicken-omelet/).',
      '- Source spot-check: Recipe for Barbecue Chicken Marinade describes a marinade to apply to chicken, and Home Fries describes a breakfast side. Those records must not establish a full main-meal slot on their own. [Marinade](https://panlasangpinoy.com/recipe-for-barbecue-chicken-marinade/), [Home Fries](https://panlasangpinoy.com/home-fries-recipe/).',
      '- Audit detection also holds title/ingredient allergen mismatches and obvious side/snack/component records; the full JSON records their IDs and reasons. This scan itself is read-only. The separate guarded repair restored source food tokens and narrowed meal/diet applicability; it granted no clinical approval. Source-by-source web verification was limited to the flagged recipe pages.',
      '',
      '## Original 17 cases',
      '',
      ...table(results.filter((row) => row.group === 'ORIGINAL_17')),
      '',
      '## All listed conditions and food restrictions',
      '',
      ...table(results.filter((row) => row.group === 'CATALOGUE')),
      '',
      '## Shortlists for the original 17',
      '',
      'These are recipes to inspect/review, never new safety approvals. The selection prefers source-published nutrition and measured/simple ingredients. Each slot includes up to seven names. Full ingredients, screening flags, IDs, source URLs and all case memberships are retained in the JSON.',
      '',
      ...results
        .filter((row) => row.group === 'ORIGINAL_17')
        .flatMap((row) => [
          `### ${row.label}`,
          '',
          ...(row.unresolved
            ? ['Clarify the actual dietary restriction first.', '']
            : types.flatMap((type) => [
                `**${type}:** ${row.shortlist[type].map((id) => escape(byId.get(id)!.name)).join('; ') || 'No conservative fitting candidate found.'}`,
                '',
              ])),
        ]),
      '## Diet and allergy intersections',
      '',
      ...table(results.filter((row) => row.group === 'INTERSECTION')),
      '',
      '## Evidence files and reproduction',
      '',
      '- Full per-recipe/per-case results: .codex-runtime/catalogue-coverage/coverage.json (local, ignored).',
      '- Reproduce from backend with CATALOGUE_AUDIT_READ_ONLY=true and the checked development DATABASE_URL: npx tsx scripts/audit-catalogue-case-candidates.ts.',
      '- The script refuses any other database host/name and performs no shared state mutations. Current staff eligibility and evidence can change after this snapshot.',
      '- Ingredient text cannot prove packaged ingredients, preparation cross-contact or unknown medical suitability. Estimated nutrition and missing extended nutrient fields remain explicit in the inventory and JSON; no missing values are replaced with zero.',
      '',
    ].join('\n');
    await writeFile(path.join(root, 'docs/MEAL_CATALOGUE_COVERAGE_2026-10-06.md'), report);
    console.log(
      JSON.stringify(
        {
          readOnly: true,
          inventory,
          cases: results
            .filter((row) => row.group === 'ORIGINAL_17')
            .map((row) => ({
              label: row.label,
              raw: row.rawCandidateCount,
              conservative: row.rawConservativeCount,
              fit: row.conservativeServingCounts[2800],
              reviewed: row.reusableLibraryCount,
            })),
          evaluatedCases: results.length,
          report: 'docs/MEAL_CATALOGUE_COVERAGE_2026-10-06.md',
        },
        null,
        2
      )
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Catalogue audit failed');
  process.exitCode = 1;
});

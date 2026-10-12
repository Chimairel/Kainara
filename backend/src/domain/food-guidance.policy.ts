import type { DietaryPreference } from '@prisma/client';
import { clinicalEvidenceSourceByCode } from './clinical-evidence-source.catalog';
import { validateGeneratedMealCandidate } from './generated-meal-validation.policy';
import type {
  CanonicalUserSafetyRestrictions,
  StructuredSafetyRestrictionEntry,
} from './structured-restriction.adapter';

export const FOOD_GUIDANCE_FORMAT_VERSION = 1;
export interface FoodGuidanceItem {
  name: string;
  reason: string;
  tip: string;
  sourceCode: string;
}
export interface FoodGuidance {
  formatVersion: number;
  avoid: FoodGuidanceItem[];
  limit: FoodGuidanceItem[];
  choose: FoodGuidanceItem[];
  discuss: FoodGuidanceItem[];
  sources: Array<{ code: string; title: string; url: string }>;
}
const DASH = 'NHLBI_DASH_EATING_PLAN_CURRENT_2026_09';
const ALLERGY = 'PH_FDA_AO_2014_0030A';
const DIABETES = 'ADA_NUTRITION_CONSENSUS_2019';
const KIDNEY = 'NIDDK_CKD_MANAGEMENT_CURRENT_2026_09';
const HEART = 'AHA_SATURATED_FAT_CURRENT_2026_09';
const PREGNANCY = 'CDC_PREGNANCY_FOOD_SAFETY_CURRENT_2026_09';
const EXAMPLES: Record<string, string> = {
  SHELLFISH: 'shrimp (hipon), crab and shrimp paste (bagoong alamang)',
  NUTS: 'peanuts (mani), cashews and peanut sauces',
  DAIRY: 'milk, cheese and foods containing whey or casein',
  GLUTEN: 'wheat bread, wheat noodles and wheat-containing soy sauce',
  EGGS: 'eggs, mayonnaise and foods made with egg',
};

/** Educational food choices, saved with the profile version; never meal certification. */
export function buildFoodGuidance(input: {
  restrictions: CanonicalUserSafetyRestrictions;
  dietaryPreference: DietaryPreference;
  declaredEntries?: readonly StructuredSafetyRestrictionEntry[];
}): FoodGuidance {
  const r = input.restrictions;
  const result: FoodGuidance = {
    formatVersion: FOOD_GUIDANCE_FORMAT_VERSION,
    avoid: [],
    limit: [],
    choose: [],
    discuss: [],
    sources: [],
  };
  const add = (
    section: 'avoid' | 'limit' | 'choose' | 'discuss',
    name: string,
    reason: string,
    tip: string,
    sourceCode: string
  ) => result[section].push({ name, reason, tip, sourceCode });
  for (const entry of r.displayEntries.filter((e) => e.domain !== 'CONDITION')) {
    const saved = input.declaredEntries?.find((row) => row.domain === entry.domain && row.displayName === entry.label);
    const candidateCode =
      typeof saved?.canonicalCode === 'string' ? saved.canonicalCode : entry.label.toUpperCase().replace(/[ -]+/g, '_');
    const code = Object.keys(EXAMPLES).find((key) => key === candidateCode);
    const label = entry.label.replace(/_/g, ' ').toLowerCase();
    const reason =
      entry.domain === 'INTOLERANCE'
        ? `You reported an intolerance to ${label}; a tolerated amount has not been established.`
        : entry.domain === 'AVOIDED_INGREDIENT'
          ? `You chose to exclude ${label} from planning.`
          : entry.domain === 'ALLERGY'
            ? `You reported an allergy to ${label}.`
            : `Your profile excludes ${label}; its classification needs clarification.`;
    add(
      'avoid',
      code ? EXAMPLES[code] : entry.label,
      reason,
      entry.domain === 'ALLERGY'
        ? 'Check ingredient labels, sauces and shared preparation equipment; ask the preparer about cross-contact.'
        : 'Keep this ingredient excluded until you and your RND clarify the restriction.',
      ALLERGY
    );
    if (!code || entry.domain === 'INTOLERANCE')
      add(
        'discuss',
        entry.label,
        'The profile does not establish which related foods or quantities are appropriate.',
        'Ask your RND to clarify the restriction before testing foods or changing it.',
        ALLERGY
      );
  }
  const has = (code: string) => r.conditions.includes(code);
  if (has('HYPERTENSION'))
    add(
      'limit',
      'Salty condiments and processed foods',
      'Soy sauce, patis, salty instant noodles and processed meats can contribute substantial sodium.',
      'Compare sodium per serving on labels; use less salty sauce and season with calamansi, herbs or spices instead.',
      DASH
    );
  if (has('DIABETES')) {
    add(
      'limit',
      'Sweetened drinks and frequent large portions of sweets',
      'Added sugar contributes carbohydrates and may make glucose management harder.',
      'Choose unsweetened drinks; discuss portions and meal timing rather than removing all rice or carbohydrates.',
      DIABETES
    );
    add(
      'discuss',
      'Rice portions, carbohydrate amounts and meal timing',
      'There is no single carbohydrate allowance for everyone with diabetes.',
      'Review your medicines, glucose response and usual meals with your RND.',
      DIABETES
    );
  }
  if (has('HEART_CONDITION')) {
    add(
      'limit',
      'Frequent fatty meats, butter and deep-fried foods',
      'These may contribute saturated fat.',
      'Compare cooking methods and fat sources; a personal saturated-fat target depends on your condition.',
      HEART
    );
    add(
      'discuss',
      'Your heart condition and personal nutrient limits',
      'A broad heart-condition label does not establish a personal diet prescription.',
      'Clarify the diagnosis and relevant treatment with your RND.',
      HEART
    );
  }
  if (has('KIDNEY_DISEASE')) {
    add(
      'limit',
      'Salty processed foods and condiments',
      'Reducing excess sodium is part of kidney-diet education.',
      'Check sodium labels; confirm your personal target with your RND.',
      KIDNEY
    );
    add(
      'discuss',
      'Protein, potassium, phosphorus and fluids',
      'Appropriate foods and amounts depend on kidney stage, blood tests and dialysis.',
      'Ask your RND before restricting fruits, vegetables or fluids, increasing protein, or using potassium-based salt substitutes.',
      KIDNEY
    );
  }
  if (has('PREGNANT')) {
    add(
      'avoid',
      'Raw or undercooked meat, seafood and eggs; unpasteurized dairy',
      'Pregnancy increases the importance of food handling and preparation checks.',
      'Choose thoroughly cooked food and pasteurized products; a recipe name does not confirm safe preparation.',
      PREGNANCY
    );
    add(
      'discuss',
      'Pregnancy-specific portions, seafood choices and caffeine',
      'Pregnancy stage and preparation details are not established by a meal name.',
      'Ask your RND which choices and quantities suit your current care plan.',
      PREGNANCY
    );
  }
  for (const condition of r.customConditions)
    add(
      'discuss',
      condition,
      'No supported food-specific rule is available for this reported condition.',
      'Keep your existing care instructions and ask your RND for individual food advice.',
      'DOST_FNRI_PDRI_2015_REV_2018'
    );

  const choices = [
    {
      name: 'Cooked vegetables such as carrots or cabbage',
      ingredients: ['carrots', 'cabbage'],
      tip: 'Use a variety of vegetables; check sauces and added ingredients.',
    },
    {
      name: 'Whole grains such as brown rice',
      ingredients: ['brown rice'],
      tip: 'Use the portion shown in your meal plan; grains still contribute carbohydrates.',
    },
    {
      name: 'Beans such as munggo',
      ingredients: ['mung beans'],
      tip: 'Check the whole recipe: munggo dishes may contain shrimp paste or meat.',
    },
    {
      name: 'Lean chicken or fish',
      ingredients: ['chicken', 'fish'],
      tip: 'Choose grilled, steamed or well-cooked preparations and check added sauces.',
    },
  ];
  // Kidney advice needs more clinical context. Unclassified custom restrictions must not be treated as an exhaustive exclusion check.
  if (!has('KIDNEY_DISEASE') && !r.customConditions.length && !r.customFoodRestrictions.length)
    for (const choice of choices) {
      const validation = validateGeneratedMealCandidate({
        ingredients: choice.ingredients.map((name) => ({ name })),
        dietaryPreference: input.dietaryPreference,
        allergens: r.allergies,
      });
      if (validation.accepted)
        add(
          'choose',
          choice.name,
          'A general food choice consistent with your recorded exclusions; preparation and portions still matter.',
          choice.tip,
          DASH
        );
    }
  if (!result.choose.length)
    add(
      'discuss',
      'Individual food choices',
      'Your saved restrictions need individual advice before suggesting additional foods.',
      'Use your reviewed meals and ask your RND for suitable alternatives.',
      has('KIDNEY_DISEASE') ? KIDNEY : 'DOST_FNRI_PDRI_2015_REV_2018'
    );
  for (const section of ['avoid', 'limit', 'choose', 'discuss'] as const)
    result[section] = result[section].filter(
      (item, index, items) => items.findIndex((other) => other.name.toLowerCase() === item.name.toLowerCase()) === index
    );
  result.sources = [
    ...new Set([...result.avoid, ...result.limit, ...result.choose, ...result.discuss].map((item) => item.sourceCode)),
  ].map((code) => {
    const source = clinicalEvidenceSourceByCode(code);
    if (!source) throw new Error(`Missing food guidance source: ${code}`);
    return { code, title: `${source.issuingOrganization} — ${source.title}`, url: source.canonicalUrl };
  });
  return result;
}

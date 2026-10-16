/** Educational preferences, not condition clearance or clinical nutrient thresholds. */
export const FOOD_CHOICE_POLICY_VERSION = 'FOOD_CHOICES_V2';
export const conditionFoodChoices = [
  {
    conditions: ['HYPERTENSION', 'KIDNEY_DISEASE'],
    name: 'Salty condiments and processed foods',
    reason: 'Salty sauces, instant noodles and processed meats can contribute substantial sodium.',
    tip: 'Compare sodium per serving; use less salty sauce and confirm any personal sodium target with your RND.',
    sourceCode: 'NHLBI_DASH_EATING_PLAN_CURRENT_2026_09',
    terms: /\b(?:soy sauce|fish sauce|patis|bagoong|instant noodles?|hotdogs?|bacon|ham|corned beef|sausage|tocino|longg?anisa)\b/iu,
  },
  {
    conditions: ['DIABETES'],
    name: 'Sweetened drinks and frequent large portions of sweets',
    reason: 'Added sugar contributes carbohydrates and may make glucose management harder.',
    tip: 'Choose unsweetened drinks; discuss portions and meal timing rather than removing all rice or carbohydrates.',
    sourceCode: 'ADA_NUTRITION_CONSENSUS_2019',
    terms: /\b(?:brown sugar|white sugar|granulated sugar|condensed milk|corn syrup|sugar syrup|arnibal|sweetened beverages?|sweetened drinks?|soft drinks?)\b/iu,
  },
  {
    conditions: ['HEART_CONDITION'],
    name: 'Frequent fatty meats, butter and deep-fried foods',
    reason: 'These may contribute saturated fat.',
    tip: 'Compare cooking methods and fat sources; a personal saturated-fat target depends on your condition.',
    sourceCode: 'AHA_SATURATED_FAT_CURRENT_2026_09',
    terms: /\b(?:pork belly|bacon|butter|lard|deep[ -]fried|lechon kawali|crispy pata)\b/iu,
  },
] as const;

export const preferredFoodChoices = [
  { name: 'Cooked vegetables such as carrots or cabbage', ingredients: ['carrots', 'cabbage'],
    tip: 'Use a variety of vegetables; check sauces and added ingredients.', terms: /\b(?:carrots?|cabbage|pechay|kangkong|broccoli)\b/iu },
  { name: 'Whole grains such as brown rice', ingredients: ['brown rice'],
    tip: 'Use the portion shown in your meal plan; grains still contribute carbohydrates.', terms: /\b(?:brown rice|whole grains?|whole wheat)\b/iu },
  { name: 'Beans such as munggo', ingredients: ['mung beans'],
    tip: 'Check the whole recipe: munggo dishes may contain shrimp paste or meat.', terms: /\b(?:mung beans?|munggo|lentils?|chickpeas?)\b/iu },
  { name: 'Lean chicken or fish', ingredients: ['chicken', 'fish'],
    tip: 'Choose grilled, steamed or well-cooked preparations and check added sauces.', terms: /\b(?:chicken breast|tilapia|bangus|tuna)\b/iu },
] as const;

/** A bounded ranking adjustment. Preferences never override exclusions or review gates. */
export function foodChoicePreference(conditions: readonly string[], ingredients: readonly string[]) {
  const text = ingredients.join(' | ').normalize('NFKC');
  const limited = conditionFoodChoices.filter(rule => rule.conditions.some(c => conditions.includes(c)) && rule.terms.test(text));
  const preferred = conditions.includes('KIDNEY_DISEASE') ? [] : preferredFoodChoices.filter(rule => rule.terms.test(text));
  return { penalty: limited.length * 0.75 - Math.min(preferred.length, 2) * 0.1,
    warnings: limited.map(rule => `${rule.name}: ${rule.reason}`),
    preferred: preferred.map(rule => rule.name), policyVersion: FOOD_CHOICE_POLICY_VERSION };
}

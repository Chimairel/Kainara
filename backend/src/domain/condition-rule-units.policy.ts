export function conditionRuleUnit(nutrient: string, basis: string) {
  return basis === 'PERCENT_OF_DAILY_CALORIES' ? '%' : basis === 'PER_KG_BODY_WEIGHT_DAILY' ? 'g/kg' :
    basis === 'PER_1000_KCAL' ? (nutrient.endsWith('_MG') ? 'mg/1000kcal' : 'g/1000kcal') :
    nutrient.endsWith('_MG') ? 'mg' : 'g';
}
export function validConditionRuleUnits(rule: { nutrient: string; basis: string; unit: string; threshold: number }) {
  return rule.unit === conditionRuleUnit(rule.nutrient, rule.basis) && Number.isFinite(rule.threshold) && rule.threshold >= 0 &&
    (rule.basis !== 'PERCENT_OF_DAILY_CALORIES' || rule.threshold <= 100 && !rule.nutrient.endsWith('_MG')) &&
    (rule.basis !== 'PER_KG_BODY_WEIGHT_DAILY' || rule.nutrient === 'PROTEIN_G');
}

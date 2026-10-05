type ObjectValue = Record<string, unknown>;
export const auditObject = (value: unknown): ObjectValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as ObjectValue) : {};
const text = (value: unknown, max = 1000) => (typeof value === 'string' ? value.slice(0, max) : null);
const number = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
export const auditNutrition = (value: unknown) => {
  const row = auditObject(value);
  return {
    calories: number(row.calories),
    proteinG: number(row.proteinG),
    carbsG: number(row.carbsG),
    fatG: number(row.fatG),
  };
};

/** A food-only projection. Never return arbitrary metadata or member/profile/photo identifiers. */
export function auditFood(value: unknown) {
  const row = auditObject(value);
  const ingredients = Array.isArray(row.ingredients)
    ? row.ingredients.slice(0, 100).flatMap((value) => {
        if (typeof value === 'string') return [{ name: value.slice(0, 200), quantity: null, unit: null }];
        const ingredient = auditObject(value);
        const name = text(ingredient.name, 200);
        return name ? [{ name, quantity: number(ingredient.quantity), unit: text(ingredient.unit, 60) }] : [];
      })
    : [];
  return {
    name: text(row.name, 1000),
    portionGrams: number(row.portionGrams),
    ingredients,
    source: text(row.source, 80),
    nutritionStatus: text(row.nutritionStatus, 80),
  };
}

export function auditFacts(value: unknown) {
  const row = auditObject(value);
  const fields = [
    ['revision', 'Revision'],
    ['reviewedRevision', 'Reviewed revision'],
    ['revisionKey', 'Recipe revision'],
    ['profileRevision', 'Profile revision'],
    ['safetyRevision', 'Safety revision'],
    ['policyVersion', 'Policy version'],
    ['decision', 'Decision'],
    ['area', 'Review area'],
    ['status', 'Status'],
    ['mediaType', 'Media type'],
    ['version', 'Version'],
  ];
  return fields.flatMap(([key, label]) => {
    const value = row[key];
    return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
      ? [{ label, value: String(value).slice(0, 200) }]
      : [];
  });
}

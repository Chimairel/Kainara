/** Read recorded values without parsing quantities or inventing a nutrition mapping. */
export function recordedIngredients(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string')
      return [{ name: item, quantity: null, unit: null, source: 'UNKNOWN', compositionFoodName: null }];
    if (!item || typeof item !== 'object') return [];
    const entry = item as Record<string, unknown>;
    const name = entry.name ?? entry.ingredientName;
    if (typeof name !== 'string') return [];
    return [
      {
        name,
        quantity: typeof entry.quantity === 'number' && Number.isFinite(entry.quantity) ? entry.quantity : null,
        unit: typeof entry.unit === 'string' ? entry.unit : null,
        source:
          typeof (entry.source ?? entry.dataSource) === 'string' ? String(entry.source ?? entry.dataSource) : 'UNKNOWN',
        compositionFoodName: typeof entry.compositionFoodName === 'string' ? entry.compositionFoodName : null,
      },
    ];
  });
}

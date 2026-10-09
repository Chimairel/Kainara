const mappings = [
  ['calories', 'calories'],
  ['proteinG', 'proteinG'],
  ['carbsG', 'carbsG'],
  ['fatG', 'fatG'],
  ['sodiumMg', 'sodium'],
  ['sugarG', 'sugar'],
  ['fiberG', 'fiber'],
  ['potassiumMg', 'potassium'],
  ['phosphorusMg', 'phosphorus'],
  ['saturatedFatG', 'saturatedFat'],
] as const;
export function demoPlateNutrition(
  base: Record<string, number | null>,
  scale: number,
  rice: Record<string, unknown> | null,
  riceG: number
) {
  if (!(scale > 0) || !Number.isFinite(scale) || riceG < 0 || !Number.isFinite(riceG))
    throw new Error('Invalid plate amount.');
  return Object.fromEntries(
    mappings.map(([field, riceField]) => {
      const value = base[field],
        side = rice?.[riceField];
      return [
        field,
        typeof value === 'number' &&
        Number.isFinite(value) &&
        value >= 0 &&
        (!riceG || (typeof side === 'number' && Number.isFinite(side) && side >= 0))
          ? Math.round((value * scale + (riceG ? ((side as number) * riceG) / 100 : 0)) * 1000) / 1000
          : null,
      ];
    })
  ) as Record<(typeof mappings)[number][0], number | null>;
}

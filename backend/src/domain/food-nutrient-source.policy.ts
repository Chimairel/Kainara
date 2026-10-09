import { createHash } from 'node:crypto';

export const FOOD_NUTRIENT_SOURCE_VERSION = 'FOOD_NUTRIENT_SOURCE_V1';
export const EXTENDED_FOOD_NUTRIENTS = ['sugar', 'phosphorus', 'saturatedFat'] as const;
export const OPTIONAL_FOOD_NUTRIENTS = [
  'fiber',
  'sodium',
  'potassium',
  'calcium',
  'iron',
  'vitaminA',
  'vitaminC',
  'vitaminB1',
  'vitaminB2',
  'niacin',
  'water',
  ...EXTENDED_FOOD_NUTRIENTS,
] as const;
export type OptionalFoodNutrients = Record<(typeof OPTIONAL_FOOD_NUTRIENTS)[number], number | null>;
export const FNRI_SOURCE_SHA256 = '669a0dc88284f99719e6a2f3e091fbbc9653447da03edf73e012215c71fc7f24';
export type ExtendedFoodNutrients = Record<(typeof EXTENDED_FOOD_NUTRIENTS)[number], number | null>;
export type SourceFood = ExtendedFoodNutrients &
  Partial<OptionalFoodNutrients> & {
    source: string;
    sourceRecordId: string;
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    evidence: Record<string, unknown>;
  };

export function sourceEvidenceFingerprint(value: unknown): string {
  const canonical = (item: unknown): unknown =>
    Array.isArray(item)
      ? item.map(canonical)
      : item && typeof item === 'object'
        ? Object.fromEntries(
            Object.entries(item)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, entry]) => [key, canonical(entry)])
          )
        : item;
  return createHash('sha256')
    .update(JSON.stringify(canonical(value ?? null)))
    .digest('hex');
}

/** Trace, blank, malformed and absent values must never become a measured zero. */
export function sourceNumber(value: unknown): number | null {
  if (typeof value === 'string') {
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value.trim())) return null;
    value = Number(value.trim());
  }
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseCsvRow(line: string): string[] {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') {
      value += '"';
      i++;
    } else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else value += char;
  }
  if (quoted) throw new Error('Unclosed source CSV quote.');
  cells.push(value.trim());
  return cells;
}

export function readFnriSource(text: string, verifyFingerprint = true): SourceFood[] {
  const sha256 = createHash('sha256').update(text).digest('hex');
  if (verifyFingerprint && sha256 !== FNRI_SOURCE_SHA256)
    throw new Error('FNRI source fingerprint changed. Review the new delivery first.');
  const lines = text.split(/\r?\n/u).filter((line) => line.trim());
  const headers = parseCsvRow(lines[0]);
  const rows: SourceFood[] = [];
  for (const line of lines.slice(1)) {
    const cells = parseCsvRow(line);
    if (cells.length !== headers.length) throw new Error('Source CSV column count differs.');
    const row = Object.fromEntries(headers.map((key, i) => [key, cells[i]]));
    if (row.has_data?.toUpperCase() !== 'TRUE') continue;
    const macros = {
      calories: sourceNumber(row['Energy, calculated (kcal)']),
      proteinG: sourceNumber(row['Protein (g)']),
      carbsG: sourceNumber(row['Carbohydrate, total (g)']),
      fatG: sourceNumber(row['Total Fat (g)']),
    };
    if (Object.values(macros).some((value) => value === null)) continue;
    const entries = headers
      .slice(6)
      .map((key) => ({ name: key, sourceValue: row[key], value: sourceNumber(row[key]) }));
    rows.push({
      source: 'FNRI',
      sourceRecordId: row.food_id,
      name: row.food_name,
      ...(macros as { calories: number; proteinG: number; carbsG: number; fatG: number }),
      fiber: sourceNumber(row['Fiber, total dietary (g)']),
      sodium: sourceNumber(row['Sodium, Na (mg)']),
      potassium: sourceNumber(row['Potassium, K (mg)']),
      calcium: sourceNumber(row['Calcium, Ca (mg)']),
      iron: sourceNumber(row['Iron, Fe (mg)']),
      vitaminA: sourceNumber(row['Retinol Activity Equivalent, RAE (µg)']),
      vitaminC: sourceNumber(row['Ascorbic Acid, Vitamin C (mg)']),
      vitaminB1: sourceNumber(row['Thiamin, Vitamin B1 (mg)']),
      vitaminB2: sourceNumber(row['Riboflavin, Vitamin B2 (mg)']),
      niacin: sourceNumber(row['Niacin (mg)']),
      water: sourceNumber(row['Water (g)']),
      sugar: sourceNumber(row['Sugars, total (g)']),
      phosphorus: sourceNumber(row['Phosphorus, P (mg)']),
      saturatedFat: sourceNumber(row['Fatty acids, saturated, total (g)']),
      evidence: {
        version: FOOD_NUTRIENT_SOURCE_VERSION,
        basis: 'PER_100_G',
        source: 'FNRI',
        sourceRecordId: row.food_id,
        sourceFile: 'prisma/data/fnri.csv',
        sourceSha256: sha256,
        entries,
      },
    });
  }
  if (new Set(rows.map((row) => row.sourceRecordId)).size !== rows.length)
    throw new Error('Duplicate FNRI source IDs.');
  return rows;
}

export function planFoodNutrientEnrichment(
  food: Partial<OptionalFoodNutrients> & {
    name: string;
    source: string;
    sourceRecordId: string | null;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    sugar?: number | null;
    phosphorus?: number | null;
    saturatedFat?: number | null;
    sourceNutrientEvidence?: unknown;
  },
  source: SourceFood
) {
  // A label alone cannot reconcile a changed preparation or a corrected composition.
  if (
    food.source !== source.source ||
    food.name !== source.name ||
    (food.sourceRecordId !== null && food.sourceRecordId !== source.sourceRecordId) ||
    (['calories', 'proteinG', 'carbsG', 'fatG'] as const).some((key) => Math.abs(food[key] - source[key]) > 0.000001)
  )
    throw new Error('Food identity/composition differs from the pinned source; manual reconciliation required.');
  const values = Object.fromEntries(
    OPTIONAL_FOOD_NUTRIENTS.map((key) => [key, food[key] ?? source[key] ?? null])
  ) as OptionalFoodNutrients;
  for (const key of OPTIONAL_FOOD_NUTRIENTS) {
    if (
      food[key] !== null &&
      food[key] !== undefined &&
      source[key] !== null &&
      source[key] !== undefined &&
      food[key] !== source[key]
    )
      throw new Error('Existing nutrient differs from the source; do not overwrite it.');
    if (values[key] !== null && values[key]! > (['sugar', 'saturatedFat', 'water'].includes(key) ? 100 : 100000))
      throw new Error('Implausible source nutrient value.');
  }
  const nutrientsChanged = OPTIONAL_FOOD_NUTRIENTS.some((key) => values[key] !== (food[key] ?? null));
  const evidenceChanged =
    sourceEvidenceFingerprint(food.sourceNutrientEvidence) !== sourceEvidenceFingerprint(source.evidence);
  return {
    ...values,
    values,
    evidence: source.evidence,
    nutrientsChanged,
    changed: nutrientsChanged || evidenceChanged,
  };
}

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { buildOutsideMealAiPrompt, type outsideMealAiItemSchema } from '../../src/domain/outside-meal-ai.policy';
import type { z } from 'zod';

const CASES = [
  { foodId: 'A020', portionGrams: 75 },
  { foodId: 'A020', portionGrams: 225 },
  { foodId: 'H004', portionGrams: 50 },
  { foodId: 'C028', portionGrams: 150 },
  { foodId: 'F265', portionGrams: 100 },
  { foodId: 'F266', portionGrams: 100 },
  { foodId: 'G076', portionGrams: 100 },
  { foodId: 'E015', portionGrams: 100 },
] as const;

export const NUTRIENTS = ['calories', 'proteinG', 'carbsG', 'fatG'] as const;
type Nutrients = Record<(typeof NUTRIENTS)[number], number>;
export type NutritionReferenceCase = { foodId: string; name: string; portionGrams: number; expected: Nutrients };

function csvCells(line: string) {
  const cells: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(value.trim());
      value = '';
    } else value += char;
  }
  cells.push(value.trim());
  return cells;
}

/** Reads existing FNRI composition, never substitutes zero for missing values. */
export function loadNutritionReferenceCases(csvPath: string) {
  const csv = readFileSync(csvPath, 'utf8');
  const lines = csv.split(/\r?\n/).filter((line) => line.trim());
  const header = csvCells(lines[0]);
  const rows = new Map(
    lines.slice(1).map((line) => {
      const cells = csvCells(line);
      return [cells[0], Object.fromEntries(header.map((key, index) => [key, cells[index]]))];
    })
  );
  const columns = {
    calories: 'Energy, calculated (kcal)',
    proteinG: 'Protein (g)',
    carbsG: 'Carbohydrate, total (g)',
    fatG: 'Total Fat (g)',
  };
  const cases: NutritionReferenceCase[] = CASES.map(({ foodId, portionGrams }) => {
    const row = rows.get(foodId);
    if (!row || row.has_data?.toUpperCase() !== 'TRUE') throw new Error(`Missing FNRI reference ${foodId}.`);
    const expected = {} as Nutrients;
    for (const key of NUTRIENTS) {
      const cell = row[columns[key]];
      if (!cell?.trim() || !Number.isFinite(Number(cell)) || Number(cell) < 0)
        throw new Error(`Incomplete FNRI reference ${foodId}: ${key}.`);
      expected[key] = (Number(cell) * portionGrams) / 100;
    }
    return { foodId, name: row.food_name, portionGrams, expected };
  });
  const request = buildOutsideMealAiPrompt(
    cases,
    'All portions are weighed edible food in the named preparation. No extra sides or ingredients.'
  );
  return {
    cases,
    request,
    referenceSha256: createHash('sha256').update(csv).digest('hex'),
    promptSha256: createHash('sha256').update(JSON.stringify(request)).digest('hex'),
  };
}

export function measureNutritionEstimates(
  cases: NutritionReferenceCase[],
  items: z.infer<typeof outsideMealAiItemSchema>[]
) {
  if (cases.length !== items.length) throw new Error('Cannot score an incomplete response.');
  const rows = cases.map((reference, index) => {
    const estimate = items[index];
    return {
      ...reference,
      returnedName: estimate.name,
      estimated: Object.fromEntries(NUTRIENTS.map((key) => [key, estimate[key]])),
      absoluteErrors: Object.fromEntries(
        NUTRIENTS.map((key) => [key, Math.abs(estimate[key] - reference.expected[key])])
      ),
      calorieRange: [estimate.calorieLow, estimate.calorieHigh],
      referenceCaloriesInsideRange:
        estimate.calorieLow <= reference.expected.calories && estimate.calorieHigh >= reference.expected.calories,
    };
  });
  return {
    rows,
    meanAbsoluteErrors: Object.fromEntries(
      NUTRIENTS.map((key) => [key, rows.reduce((sum, row) => sum + row.absoluteErrors[key], 0) / rows.length])
    ),
    meanAbsoluteCaloriePercentError:
      rows.reduce((sum, row) => sum + (row.absoluteErrors.calories / row.expected.calories) * 100, 0) / rows.length,
    calorieRangeCoverage: rows.filter((row) => row.referenceCaloriesInsideRange).length / rows.length,
  };
}

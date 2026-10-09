import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  FOOD_NUTRIENT_SOURCE_VERSION,
  readFnriSource,
  sourceNumber,
  type SourceFood,
} from '../../src/domain/food-nutrient-source.policy';

export async function loadFoodNutrientSources() {
  const directory = path.resolve(__dirname, '../../prisma/data');
  const fnri = readFnriSource(await readFile(path.join(directory, 'fnri.csv'), 'utf8'));
  const buffer = await readFile(path.join(directory, 'usda-fdc-catalogue.json'));
  const catalogue = JSON.parse(buffer.toString('utf8'));
  if (!Array.isArray(catalogue.records) || !catalogue.nutrientDefinitions || !Array.isArray(catalogue.datasets))
    throw new Error('Regenerate the USDA nutrient evidence snapshot first.');
  const usda: SourceFood[] = catalogue.records.map((row: any) => {
    if (!Array.isArray(row.nutrientEvidence)) throw new Error('USDA nutrient entries missing.');
    const definitions = Object.fromEntries(
      row.nutrientEvidence.map(([id]: [number]) => {
        if (!catalogue.nutrientDefinitions[id]) throw new Error('USDA nutrient unit/name missing.');
        return [id, catalogue.nutrientDefinitions[id]];
      })
    );
    // Derivation IDs and definitions preserve units; missing values stay null.
    return {
      source: 'USDA_FDC',
      sourceRecordId: String(row.fdcId),
      name: row.name,
      calories: row.calories,
      proteinG: row.proteinG,
      carbsG: row.carbsG,
      fatG: row.fatG,
      sugar: sourceNumber(row.sugar),
      phosphorus: sourceNumber(row.phosphorus),
      saturatedFat: sourceNumber(row.saturatedFat),
      ...Object.fromEntries(
        [
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
        ].map((key) => [key, sourceNumber(row[key])])
      ),
      evidence: {
        version: FOOD_NUTRIENT_SOURCE_VERSION,
        basis: 'PER_100_G',
        source: 'USDA_FDC',
        sourceRecordId: String(row.fdcId),
        sourceUrl: row.sourceUrl,
        dataset: row.dataset,
        publishedAt: row.publishedAt,
        entries: row.nutrientEvidence,
        definitions,
        deliveries: catalogue.datasets,
      },
    };
  });
  const usdaHash = createHash('sha256').update(buffer).digest('hex');
  return {
    fnri,
    usda,
    fingerprint: createHash('sha256')
      .update(JSON.stringify([fnri[0]?.evidence.sourceSha256, usdaHash]))
      .digest('hex'),
  };
}

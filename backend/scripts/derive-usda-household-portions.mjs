/* global console */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const catalogue = JSON.parse(await readFile('prisma/data/usda-fdc-catalogue.json', 'utf8'));
const eligible = new Set(catalogue.records.map((row) => row.fdcId));
const records = [];
for (const source of catalogue.datasets) {
  const buffer = await readFile(path.join('data/usda/source-delivery', source.file));
  if (createHash('sha256').update(buffer).digest('hex') !== source.sha256)
    throw new Error(`Unexpected source fingerprint: ${source.file}`);
  for (const food of JSON.parse(buffer.toString('utf8'))[source.key]) {
    if (!food || !eligible.has(food.fdcId)) continue;
    const portions = (food.foodPortions ?? [])
      .flatMap((portion) => {
        const amount = portion.amount ?? portion.value;
        if (!(amount > 0) || !(portion.gramWeight > 0)) return [];
        const measure = portion.measureUnit?.name;
        return [
          {
            id: portion.id,
            amount,
            grams: portion.gramWeight,
            description:
              measure && measure !== 'undetermined'
                ? `${measure} ${portion.modifier ?? ''}`.trim()
                : (portion.modifier ?? portion.portionDescription ?? ''),
          },
        ];
      })
      .filter((portion) => portion.description);
    if (portions.length) records.push({ fdcId: food.fdcId, name: food.description, portions });
  }
}
records.sort((a, b) => a.fdcId - b.fdcId);
await writeFile(
  'prisma/data/usda-household-portions.json',
  JSON.stringify({ version: 'USDA_HOUSEHOLD_PORTIONS_V1', deliveries: catalogue.datasets, records }) + '\n'
);
console.log(
  JSON.stringify({
    foodsWithPortions: records.length,
    portions: records.reduce((sum, row) => sum + row.portions.length, 0),
  })
);

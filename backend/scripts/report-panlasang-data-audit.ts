import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { sourceDataAuditLabel } from '../src/domain/source-data-audit.policy';

const prisma = new PrismaClient();

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function csv(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

async function main() {
  const rows = await prisma.rawRecipeCandidate.findMany({
    where: { sourceName: 'PANLASANG_PINOY' },
    select: { sourceRecordId: true, recipeName: true, sourceUrl: true, status: true,
      calories: true, proteinG: true, carbsG: true, fatG: true, publishedNutrition: true },
    orderBy: { sourceRecordId: 'asc' },
  });
  const marked = rows.flatMap((row) => {
    const label = sourceDataAuditLabel(row.publishedNutrition);
    if (!label) return [];
    const published = record(row.publishedNutrition);
    const audit = record(published.dataCompletionAudit);
    const estimate = record(audit.nutritionEstimate);
    const operations = Array.isArray(audit.operations)
      ? audit.operations.filter((item): item is string => typeof item === 'string') : [];
    return [{ row, label, published, audit, estimate, operations }];
  });

  if (!process.argv.includes('--csv')) {
    console.log(JSON.stringify({
      panlasangMeals: rows.length,
      auditedMeals: marked.length,
      comparableRecipeNutrition: marked.filter((item) =>
        item.operations.includes('CODEX_SIMILAR_RECIPE_ESTIMATE_V1')).length,
      sourceTextMeasurements: marked.filter((item) =>
        item.operations.includes('CODEX_SOURCE_TEXT_MEASUREMENT_V1')).length,
      correctedMissingNutrition: marked.filter((item) =>
        item.operations.includes('MISSING_SOURCE_NUTRITION_RECORDED_AS_NULL')).length,
      csvCommand: 'npx tsx scripts/report-panlasang-data-audit.ts --csv',
    }, null, 2));
    return;
  }

  const headings = ['sourceRecordId', 'recipeName', 'sourceUrl', 'status', 'auditLabel',
    'operations', 'recordedAt', 'donorSourceIds', 'calories', 'proteinG', 'carbsG', 'fatG',
    'publishedCalories', 'publishedProteinG', 'publishedCarbsG', 'publishedFatG'];
  process.stdout.write(headings.join(',') + '\n');
  for (const { row, label, published, audit, estimate, operations } of marked) {
    const values = [row.sourceRecordId, row.recipeName, row.sourceUrl, row.status, label,
      operations.join('|'), audit.recordedAt,
      Array.isArray(estimate.donorSourceIds) ? estimate.donorSourceIds.join('|') : '',
      row.calories, row.proteinG, row.carbsG, row.fatG,
      published.calories, published.proteinG, published.carbsG, published.fatG];
    process.stdout.write(values.map(csv).join(',') + '\n');
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

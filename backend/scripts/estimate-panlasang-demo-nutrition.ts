import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import { DEMO_NUTRITION_ESTIMATE_VERSION, estimateFromComparableRecipes,
  type ComparableRecipe, type SourceNutrition } from '../src/domain/source-nutrition-estimate.policy';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const now = new Date();
const keys = ['calories', 'proteinG', 'carbsG', 'fatG'] as const;

function ingredients(value: Prisma.JsonValue): Array<{ name: string }> {
  return Array.isArray(value) ? value.flatMap((item) =>
    item && typeof item === 'object' && !Array.isArray(item) && typeof item.name === 'string'
      ? [{ name: item.name }] : []) : [];
}

async function main() {
  const rows = await prisma.rawRecipeCandidate.findMany({
    where: { sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE' },
    select: { id: true, sourceRecordId: true, recipeName: true, category: true, mealType: true,
      ingredients: true, publishedNutrition: true, calories: true, proteinG: true,
      carbsG: true, fatG: true, updatedAt: true },
    orderBy: { sourceRecordId: 'asc' },
  });
  const donors: ComparableRecipe[] = rows.flatMap((row) => {
    const published = row.publishedNutrition;
    if (!published || typeof published !== 'object' || Array.isArray(published) ||
        !keys.every((key) => typeof published[key] === 'number' && Number.isFinite(published[key]))) return [];
    return [{ id: row.id, recipeName: row.recipeName, category: row.category,
      mealType: row.mealType, ingredients: ingredients(row.ingredients),
      nutrition: Object.fromEntries(keys.map((key) => [key, published[key]])) as SourceNutrition }];
  });
  const changes: Array<{ before: typeof rows[number]; data: Prisma.RawRecipeCandidateUpdateManyMutationInput }> = [];
  const summary = { scanned: rows.length, publishedDonors: donors.length,
    demoEstimatedMeals: 0, fallbackEstimates: 0, unestimableMeals: 0 };
  for (const row of rows) {
    const published = row.publishedNutrition && typeof row.publishedNutrition === 'object' &&
      !Array.isArray(row.publishedNutrition) ? row.publishedNutrition as Record<string, unknown> : {};
    if (keys.every((key) => typeof published[key] === 'number' && Number.isFinite(published[key]))) continue;
    const audit = published.dataCompletionAudit && typeof published.dataCompletionAudit === 'object' &&
      !Array.isArray(published.dataCompletionAudit) ? published.dataCompletionAudit as Record<string, unknown> : {};
    if (Array.isArray(audit.operations) && audit.operations.includes(DEMO_NUTRITION_ESTIMATE_VERSION)) continue;
    const estimate = estimateFromComparableRecipes({ id: row.id, recipeName: row.recipeName,
      category: row.category, mealType: row.mealType, ingredients: ingredients(row.ingredients) }, donors);
    if (!estimate) { summary.unestimableMeals++; continue; }
    summary.demoEstimatedMeals++;
    if (estimate.fallback) summary.fallbackEstimates++;
    const operations = Array.isArray(audit.operations)
      ? audit.operations.filter((item): item is string => typeof item === 'string') : [];
    const data = Object.fromEntries(keys.map((key) => [key,
      typeof published[key] === 'number' && Number.isFinite(published[key])
        ? published[key] : estimate.nutrition[key]])) as SourceNutrition;
    changes.push({ before: row, data: { ...data,
      publishedNutrition: { ...published, dataCompletionAudit: {
        ...audit, actor: 'Codex', version: 'CODEX_PANLASANG_DATA_AUDIT_V1',
        recordedAt: audit.recordedAt ?? now.toISOString(),
        operations: [...new Set([...operations, DEMO_NUTRITION_ESTIMATE_VERSION])],
        nutritionEstimate: { method: DEMO_NUTRITION_ESTIMATE_VERSION,
          donorSourceIds: estimate.donorIds, fallback: estimate.fallback,
          calculatedAt: now.toISOString(),
          note: 'Demonstration approximation from similar recipes. Not published by Panlasang Pinoy or independently reviewed.' },
      } } as Prisma.InputJsonValue,
    } });
  }
  console.log(JSON.stringify({ ...summary, apply }, null, 2));
  if (!apply || !changes.length) return;
  const backupDirectory = path.resolve('.data-audit-backups');
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory,
    `nutrition-before-${now.toISOString().replace(/[:.]/gu, '-')}.jsonl`);
  await writeFile(backupPath, changes.map(({ before }) => JSON.stringify(before)).join('\n') + '\n',
    { encoding: 'utf8', flag: 'wx' });
  for (let offset = 0; offset < changes.length; offset += 25) {
    const results = await prisma.$transaction(changes.slice(offset, offset + 25).map(({ before, data }) =>
      prisma.rawRecipeCandidate.updateMany({ where: { id: before.id, updatedAt: before.updatedAt }, data })));
    if (results.some((result) => result.count !== 1)) {
      throw new Error('A source record changed during estimation. Stop and rerun the dry-run before applying again.');
    }
  }
  console.log(`Applied ${changes.length} clearly labeled demo estimates. Rollback source: ${backupPath}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());

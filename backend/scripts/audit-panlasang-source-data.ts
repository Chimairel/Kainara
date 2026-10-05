import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  recoverSourceIngredientMeasurement,
  SOURCE_INGREDIENT_RECOVERY_VERSION,
} from '../src/domain/source-ingredient-recovery.policy';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const now = new Date();

async function main() {
  const rows = await prisma.rawRecipeCandidate.findMany({
    where: { sourceName: 'PANLASANG_PINOY', status: 'AVAILABLE' },
    select: {
      id: true,
      sourceRecordId: true,
      recipeName: true,
      contentSignature: true,
      updatedAt: true,
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      originalServings: true,
      ingredients: true,
      publishedNutrition: true,
    },
    orderBy: { sourceRecordId: 'asc' },
  });
  const changes: Array<{ before: (typeof rows)[number]; data: Prisma.RawRecipeCandidateUpdateManyMutationInput }> = [];
  const summary = {
    scanned: rows.length,
    alteredMeals: 0,
    correctedMissingNutrients: 0,
    recoveredIngredientUnits: 0,
    recoveredFractions: 0,
    unresolvedIngredientAmounts: 0,
  };

  for (const row of rows) {
    const original =
      row.publishedNutrition && typeof row.publishedNutrition === 'object' && !Array.isArray(row.publishedNutrition)
        ? (row.publishedNutrition as Record<string, unknown>)
        : {};
    const fields = ['calories', 'proteinG', 'carbsG', 'fatG'] as const;
    const correction = Object.fromEntries(
      fields.map((key) => [key, original[key] === null && row[key] === 0 ? null : row[key]])
    ) as Record<(typeof fields)[number], number | null>;
    const corrected = fields.filter((key) => correction[key] !== row[key]);
    const ingredients = Array.isArray(row.ingredients) ? row.ingredients : [];
    let unitCount = 0;
    let fractionCount = 0;
    const recovered = ingredients.map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const result = recoverSourceIngredientMeasurement(value as Record<string, unknown>, row.originalServings);
      if (result.method === 'UNIT_FROM_SOURCE_TEXT') unitCount++;
      if (result.method === 'FRACTION_FROM_SOURCE_TEXT') fractionCount++;
      return result.ingredient;
    });
    summary.unresolvedIngredientAmounts += recovered.filter(
      (value) =>
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        typeof value.quantity !== 'number' ||
        value.quantity <= 0 ||
        !value.unit
    ).length;
    if (!corrected.length && !unitCount && !fractionCount) continue;
    summary.alteredMeals++;
    summary.correctedMissingNutrients += corrected.length;
    summary.recoveredIngredientUnits += unitCount;
    summary.recoveredFractions += fractionCount;
    const priorAudit =
      original.dataCompletionAudit &&
      typeof original.dataCompletionAudit === 'object' &&
      !Array.isArray(original.dataCompletionAudit)
        ? (original.dataCompletionAudit as Record<string, unknown>)
        : null;
    const operations = [
      ...(Array.isArray(priorAudit?.operations)
        ? priorAudit.operations.filter((item): item is string => typeof item === 'string')
        : []),
      ...(corrected.length ? ['MISSING_SOURCE_NUTRITION_RECORDED_AS_NULL'] : []),
      ...(unitCount || fractionCount ? [SOURCE_INGREDIENT_RECOVERY_VERSION] : []),
    ];
    const publishedNutrition = {
      ...original,
      dataCompletionAudit: {
        actor: 'Codex',
        version: 'CODEX_PANLASANG_DATA_AUDIT_V1',
        recordedAt: priorAudit?.recordedAt ?? now.toISOString(),
        operations: [...new Set(operations)],
        note: 'Source measurements recovered only where explicit in the recipe text; absent published nutrients remain unknown.',
      },
    };
    changes.push({
      before: row,
      data: {
        ...correction,
        ingredients: recovered as Prisma.InputJsonValue,
        publishedNutrition: publishedNutrition as Prisma.InputJsonValue,
      },
    });
  }

  console.log(JSON.stringify({ ...summary, apply }, null, 2));
  if (!apply || !changes.length) return;
  const backupDirectory = path.resolve('.data-audit-backups');
  await mkdir(backupDirectory, { recursive: true });
  const backupPath = path.join(backupDirectory, `panlasang-before-${now.toISOString().replace(/[:.]/gu, '-')}.jsonl`);
  await writeFile(backupPath, changes.map(({ before }) => JSON.stringify(before)).join('\n') + '\n', {
    encoding: 'utf8',
    flag: 'wx',
  });
  for (let offset = 0; offset < changes.length; offset += 25) {
    await prisma
      .$transaction(
        changes
          .slice(offset, offset + 25)
          .map(({ before, data }) =>
            prisma.rawRecipeCandidate.updateMany({ where: { id: before.id, updatedAt: before.updatedAt }, data })
          )
      )
      .then((results) => {
        if (results.some((result) => result.count !== 1)) {
          throw new Error(
            'A source record changed during the audit. Stop and rerun the dry-run before applying again.'
          );
        }
      });
  }
  console.log(`Applied ${changes.length} audited recipe corrections. Rollback source: ${backupPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

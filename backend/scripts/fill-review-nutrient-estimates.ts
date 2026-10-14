/** Owner-authorized supplementary estimates. Canonical published facts, macros and clinical state stay unchanged. */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import {
  estimateReviewNutrients,
  type NutrientReference,
  REVIEW_NUTRIENT_ESTIMATE_VERSION,
  recipeEstimateFingerprint,
} from '../src/domain/review-nutrient-estimate.policy';
import { publishedExtendedNutrients } from '../src/domain/review-plate-nutrients.policy';
const db = new PrismaClient(),
  args = process.argv.slice(2),
  apply = args.includes('--apply');
const target = new URL(process.env.DATABASE_URL ?? '');
const local =
  target.hostname === '127.0.0.1' &&
  target.port === '55432' &&
  target.pathname === '/kainara_recipe_nutrient_rehearsal_20261014';
if (
  !local &&
  (target.hostname !== 'ep-soft-bonus-b35ab8jw-pooler.c-4.ap-southeast-1.aws.neon.tech' ||
    target.pathname !== '/neondb')
)
  throw new Error('Unexpected target');
const directory = path.resolve('.local/recipe-nutrient-backfill-20261014', local ? 'rehearsal' : 'shared');
const hash = (v: Buffer) => createHash('sha256').update(v).digest('hex');
const object = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
async function main() {
  await mkdir(directory, { recursive: true });
  const bytes = await readFile(path.resolve('prisma/data/usda-fdc-catalogue.json'));
  const catalogue = JSON.parse(bytes.toString('utf8')),
    sourceSha256 = hash(bytes);
  const keys = [
    ['sodium', 'sodiumMg'],
    ['sugar', 'sugarG'],
    ['fiber', 'fiberG'],
    ['potassium', 'potassiumMg'],
    ['phosphorus', 'phosphorusMg'],
    ['saturatedFat', 'saturatedFatG'],
  ] as const;
  const references: NutrientReference[] = catalogue.records
    .filter(
      (r: Record<string, unknown>) =>
        finite(r.calories) &&
        r.calories >= 5 &&
        !/spices|fats and oils|baby foods|nutrition bars|protein powders|infant|supplements/i.test(String(r.category))
    )
    .map((r: Record<string, unknown>) => ({
      id: `USDA_FDC_${r.fdcId}`,
      name: String(r.name),
      category: String(r.category),
      calories: r.calories,
      proteinG: r.proteinG,
      carbsG: r.carbsG,
      fatG: r.fatG,
      ...Object.fromEntries(keys.map(([from, to]) => [to, finite(r[from]) ? r[from] : null])),
    })) as NutrientReference[];
  const rows = await db.rawRecipeCandidate.findMany({ where: { status: 'AVAILABLE' }, orderBy: { id: 'asc' } });
  for (const r of rows) {
    const p = object(r.publishedNutrition);
    if (
      r.sourceName !== 'PANLASANG_PINOY' ||
      !['calories', 'proteinG', 'carbsG', 'fatG'].every((k) => finite(p[k])) ||
      object(p.dataCompletionAudit).nutritionEstimate
    )
      continue;
    references.push({
      id: `RECIPE_${r.id}`,
      name: r.recipeName,
      category: r.category ?? '',
      calories: p.calories as number,
      proteinG: p.proteinG as number,
      carbsG: p.carbsG as number,
      fatG: p.fatG as number,
      ...publishedExtendedNutrients(p),
    } as NutrientReference);
  }
  const patches = [];
  let unavailable = 0;
  for (const before of rows) {
    const prior = object(before.publishedNutrition);
    if (
      object(prior.extendedNutritionEstimates).version === REVIEW_NUTRIENT_ESTIMATE_VERSION &&
      object(prior.extendedNutritionEstimates).inputFingerprint ===
        recipeEstimateFingerprint({ ...before, name: before.recipeName })
    )
      continue;
    const estimate = estimateReviewNutrients(
      { ...before, name: before.recipeName },
      before.publishedNutrition,
      references,
      sourceSha256
    );
    if (estimate) patches.push({ before, estimate });
    else if (Object.values(publishedExtendedNutrients(prior)).some((v) => v == null)) unavailable++;
    if ((patches.length + unavailable) % 250 === 0)
      console.log(JSON.stringify({ progress: patches.length + unavailable, total: rows.length }));
  }
  const rice = await db.foodItem.findFirstOrThrow({
    where: { source: 'FNRI', name: { equals: 'Rice, well-milled, boiled', mode: 'insensitive' } },
    orderBy: { id: 'asc' },
  });
  const riceKnown = Object.fromEntries(keys.map(([from, to]) => [to, rice[from as keyof typeof rice]]));
  const riceEstimate =
    object(object(rice.sourceNutrientEvidence).reviewNutrientEstimates).version === REVIEW_NUTRIENT_ESTIMATE_VERSION
      ? null
      : estimateReviewNutrients({ ...rice, ingredients: [] }, riceKnown, references, sourceSha256);
  const summary = {
    checkedAt: new Date().toISOString(),
    mode: apply ? 'APPLY' : 'DRY_RUN',
    target: local ? 'OWNED_REHEARSAL' : 'nameless-dust-38810716/br-round-art-b355gp02',
    sourceSha256,
    referenceCount: references.length,
    recipes: patches.length,
    estimateValues: patches.reduce((n, p) => n + Object.keys(p.estimate.values).length, 0),
    missingValuesCovered: patches.reduce((n, p) => n + p.estimate.sourceMissingKeys.length, 0),
    riceEstimateFields: riceEstimate?.sourceMissingKeys ?? [],
    unavailable,
    canonicalValuesChanged: 0,
    macrosChanged: 0,
    approvalsChanged: 0,
  };
  await writeFile(
    path.join(directory, apply ? 'estimates-apply-proposal.json' : 'estimates-proposal.json'),
    JSON.stringify({
      summary,
      recipes: patches.map((p) => ({ id: p.before.id, name: p.before.recipeName, estimate: p.estimate })),
    })
  );
  console.log(JSON.stringify(summary));
  if (!apply || (!patches.length && !riceEstimate)) return;
  const b = args.indexOf('--verified-backup'),
    h = args.indexOf('--backup-sha256');
  if (b < 0 || h < 0) throw new Error('Verified backup required');
  const backup = await readFile(args[b + 1]);
  if (backup.subarray(0, 5).toString() !== 'PGDMP' || hash(backup) !== args[h + 1]) throw new Error('Backup differs');
  await writeFile(
    path.join(directory, `estimates-before-${Date.now()}.json`),
    JSON.stringify({ rows: patches.map((p) => p.before), rice }),
    { flag: 'wx', mode: 0o600 }
  );
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741010)`;
      for (let offset = 0; offset < patches.length; offset += 100) {
        const batch = patches.slice(offset, offset + 100),
          payload = batch.map((p) => ({
            id: p.before.id,
            revision: p.before.updatedAt.toISOString(),
            signature: p.before.contentSignature,
            before: p.before.publishedNutrition,
            next: {
              ...object(p.before.publishedNutrition),
              extendedNutritionEstimates: { ...p.estimate, recordedAt: summary.checkedAt },
            },
          }));
        const changed =
          await tx.$executeRaw`UPDATE "RawRecipeCandidate" r SET "publishedNutrition"=p.next,"updatedAt"=NOW()
    FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) p(id text,revision timestamptz,signature text,before jsonb,next jsonb)
    WHERE r.id=p.id AND r."updatedAt"=p.revision AND r."contentSignature"=p.signature
    AND r."publishedNutrition" IS NOT DISTINCT FROM NULLIF(p.before,'null'::jsonb)`;
        if (changed !== batch.length)
          throw new Error('Source changed after preview; entire estimate update rolled back');
      }
      if (riceEstimate) {
        await tx.$executeRaw`SELECT id FROM "FoodItem" WHERE id=${rice.id} FOR UPDATE`;
        const current = await tx.foodItem.findUniqueOrThrow({
          where: { id: rice.id },
          select: { sourceNutrientEvidence: true },
        });
        if (JSON.stringify(current.sourceNutrientEvidence) !== JSON.stringify(rice.sourceNutrientEvidence))
          throw new Error('Rice nutrient evidence changed after preview');
        const changed = await tx.foodItem.updateMany({
          where: { id: rice.id, compositionRevision: rice.compositionRevision },
          data: {
            sourceNutrientEvidence: {
              ...object(rice.sourceNutrientEvidence),
              reviewNutrientEstimates: { ...riceEstimate, recordedAt: summary.checkedAt },
            },
          },
        });
        if (changed.count !== 1) throw new Error('Rice composition changed after preview');
      }
      await tx.auditEvent.create({
        data: {
          action: 'REVIEW_NUTRIENT_ESTIMATES_ADDED',
          entityType: 'RawRecipeCandidate',
          metadata: {
            ...summary,
            version: REVIEW_NUTRIENT_ESTIMATE_VERSION,
            estimated: true,
            reviewOnly: true,
            clinicalApprovalGranted: false,
            backupSha256: args[h + 1],
          },
        },
      });
    },
    { isolationLevel: 'Serializable', timeout: 120000 }
  );
  const after = await db.rawRecipeCandidate.findMany({
    where: { id: { in: patches.map((p) => p.before.id) } },
    select: {
      id: true,
      calories: true,
      proteinG: true,
      carbsG: true,
      fatG: true,
      ingredients: true,
      contentSignature: true,
      publishedNutrition: true,
    },
  });
  for (const p of patches) {
    const r = after.find((x) => x.id === p.before.id)!;
    if (
      r.contentSignature !== p.before.contentSignature ||
      JSON.stringify(r.ingredients) !== JSON.stringify(p.before.ingredients) ||
      ['calories', 'proteinG', 'carbsG', 'fatG'].some(
        (k) => r[k as keyof typeof r] !== p.before[k as keyof typeof p.before]
      )
    )
      throw new Error('Preserved source inputs differ');
    const published = object(r.publishedNutrition),
      original = object(p.before.publishedNutrition);
    for (const k of Object.keys(original))
      if (JSON.stringify(original[k]) !== JSON.stringify(published[k]))
        throw new Error('Original published values differ');
  }
  await writeFile(
    path.join(directory, 'estimates-result.json'),
    JSON.stringify({ ...summary, applied: true, postflightPreserved: true }, null, 2)
  );
  console.log(
    JSON.stringify({
      applied: true,
      recipes: patches.length,
      values: summary.estimateValues,
      postflightPreserved: true,
    })
  );
}
main()
  .catch(() => {
    console.error('Estimate completion failed; inspect the private proposal/backup.');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

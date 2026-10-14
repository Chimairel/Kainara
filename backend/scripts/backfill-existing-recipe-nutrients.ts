/** Normalize existing complete recipe calculations. No new estimates, source substitutions or approvals. */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { existingRecipeExtendedFill } from '../src/domain/recipe-extended-backfill.policy';

const target = new URL(process.env.DATABASE_URL ?? '');
const rehearsal =
  target.hostname === '127.0.0.1' &&
  target.port === '55432' &&
  target.pathname === '/kainara_recipe_nutrient_rehearsal_20261014';
if (
  !rehearsal &&
  (target.hostname !== 'ep-soft-bonus-b35ab8jw-pooler.c-4.ap-southeast-1.aws.neon.tech' ||
    target.pathname !== '/neondb')
)
  throw new Error('Only the owner-authorized defense database is permitted.');
const db = new PrismaClient();
const args = process.argv.slice(2),
  apply = args.includes('--apply');
const directory = path.resolve('.local/recipe-nutrient-backfill-20261014', rehearsal ? 'rehearsal' : 'shared');
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
async function main() {
  await mkdir(directory, { recursive: true });
  const rows = await db.rawRecipeCandidate.findMany({
    where: { sourceName: 'DEMO_STANDARD_PORTION', status: 'AVAILABLE' },
    include: {
      libraryVariants: {
        select: {
          id: true,
          status: true,
          verifiedByNutritionistId: true,
          safetyReviewedByNutritionistId: true,
          reviewLineage: { select: { state: true } },
        },
      },
    },
    orderBy: { id: 'asc' },
  });
  const patches: Array<{ before: (typeof rows)[number]; plan: NonNullable<ReturnType<typeof existingRecipeExtendedFill>> }> = [];
  for (const before of rows) {
    const plan = existingRecipeExtendedFill(before);
    if (
      !plan ||
      before.libraryVariants.some(
        (x) =>
          x.status !== 'APPROVED' ||
          x.verifiedByNutritionistId ||
          x.safetyReviewedByNutritionistId ||
          (x.reviewLineage && x.reviewLineage.state !== 'PUBLISHED')
      )
    )
      continue;
    const used = await db.mealPlan.count({ where: { sourceRawRecipeCandidateId: before.id } });
    const reviewed = await db.mealBaseVerification.count({
      where: { targetKind: 'RAW_RECIPE', targetId: before.id, status: 'VERIFIED' },
    });
    if (used || reviewed) continue;
    patches.push({ before, plan });
  }
  const summary = {
    checkedAt: new Date().toISOString(),
    projectId: 'nameless-dust-38810716',
    branchId: 'br-round-art-b355gp02',
    mode: apply ? 'APPLY' : 'DRY_RUN',
    recipes: patches.length,
    values: patches.reduce((n, x) => n + Object.keys(x.plan.fill).length, 0),
    newEstimates: 0,
    clinicalApprovalsGranted: 0,
    changes: patches.map((x) => ({ name: x.before.recipeName, ...x.plan })),
  };
  await writeFile(
    path.join(directory, apply ? 'apply-proposal.json' : 'proposal.json'),
    JSON.stringify(summary, null, 2)
  );
  console.log(JSON.stringify(summary));
  if (!apply || !patches.length) return;
  const index = args.indexOf('--verified-backup'),
    digest = args.indexOf('--backup-sha256');
  if (index < 0 || digest < 0) throw new Error('Apply requires a verified full backup and SHA-256.');
  const backup = await readFile(path.resolve(args[index + 1]));
  if (backup.subarray(0, 5).toString() !== 'PGDMP' || sha(backup) !== args[digest + 1])
    throw new Error('Backup fingerprint mismatch.');
  await writeFile(path.join(directory, `before-${Date.now()}.json`), JSON.stringify(patches.map((x) => x.before)), {
    flag: 'wx',
    mode: 0o600,
  });
  await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(741010)`;
      for (const { before, plan } of patches) {
        await tx.$queryRaw`SELECT id FROM "RawRecipeCandidate" WHERE id=${before.id} FOR UPDATE`;
        const current = await tx.rawRecipeCandidate.findUniqueOrThrow({
          where: { id: before.id },
          include: {
            libraryVariants: {
              select: {
                status: true,
                verifiedByNutritionistId: true,
                safetyReviewedByNutritionistId: true,
                reviewLineage: { select: { state: true } },
              },
            },
          },
        });
        if (
          current.updatedAt.getTime() !== before.updatedAt.getTime() ||
          current.contentSignature !== before.contentSignature ||
          JSON.stringify(current.publishedNutrition) !== JSON.stringify(before.publishedNutrition) ||
          JSON.stringify(current.ingredients) !== JSON.stringify(before.ingredients) ||
          current.status !== 'AVAILABLE' ||
          current.libraryVariants.some(
            (x) =>
              x.status !== 'APPROVED' ||
              x.verifiedByNutritionistId ||
              x.safetyReviewedByNutritionistId ||
              (x.reviewLineage && x.reviewLineage.state !== 'PUBLISHED')
          ) ||
          (await tx.mealPlan.count({ where: { sourceRawRecipeCandidateId: before.id } })) ||
          (await tx.mealBaseVerification.count({
            where: { targetKind: 'RAW_RECIPE', targetId: before.id, status: 'VERIFIED' },
          }))
        )
          throw new Error('Recipe changed, was used or reviewed after preview; all writes rolled back.');
        const published = before.publishedNutrition as Prisma.InputJsonObject;
        await tx.rawRecipeCandidate.update({
          where: { id: before.id },
          data: {
            publishedNutrition: {
              ...published,
              ...plan.fill,
              extendedNutritionEvidence: {
                basis: plan.basis,
                estimated: true,
                calculationSignature: plan.calculationSignature,
                recordedAt: summary.checkedAt,
                clinicalCertification: false,
              },
            },
          },
        });
        await tx.auditEvent.create({
          data: {
            action: 'EXISTING_RECIPE_NUTRIENTS_EXPOSED',
            entityType: 'RawRecipeCandidate',
            entityId: before.id,
            metadata: {
              fields: Object.keys(plan.fill),
              basis: plan.basis,
              calculationSignature: plan.calculationSignature,
              estimated: true,
              existingValuesPreserved: true,
              clinicalApprovalGranted: false,
            },
          },
        });
      }
    },
    { isolationLevel: 'Serializable', timeout: 60000 }
  );
  const after = await db.rawRecipeCandidate.findMany({ where: { id: { in: patches.map((x) => x.before.id) } } });
  for (const { before, plan } of patches) {
    const row = after.find((x) => x.id === before.id)!;
    for (const [key, value] of Object.entries(plan.fill))
      if ((row.publishedNutrition as Record<string, unknown>)[key] !== value)
        throw new Error('Postflight nutrient mismatch.');
    if (
      row.contentSignature !== before.contentSignature ||
      row.calories !== before.calories ||
      JSON.stringify(row.ingredients) !== JSON.stringify(before.ingredients)
    )
      throw new Error('Postflight preserved recipe mismatch.');
  }
  await writeFile(
    path.join(directory, 'result.json'),
    JSON.stringify(
      {
        ...summary,
        applied: true,
        idempotent: after.every((row) => !existingRecipeExtendedFill(row)),
        backupSha256: args[digest + 1],
      },
      null,
      2
    )
  );
  console.log(
    JSON.stringify({
      applied: true,
      recipes: patches.length,
      values: summary.values,
      idempotent: after.every((row) => !existingRecipeExtendedFill(row)),
    })
  );
}
main()
  .catch(async (error: unknown) => {
    await writeFile(path.join(directory,'failure.private.json'),JSON.stringify({type:error instanceof Error?error.name:'Unknown',message:error instanceof Error?error.message:'Unknown error'}));
    console.error('Recipe nutrient normalization failed; inspect the private proposal/backup.');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

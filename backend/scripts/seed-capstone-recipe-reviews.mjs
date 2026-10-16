/** Explicit capstone fixtures. This does not represent professional or patient-specific review. */
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';

export const SEED_RATIONALE =
  'CAPSTONE_SIMULATION_V1: Seeded recipe-verification fixture for the academic demonstration. No individual professional review or member-specific condition/allergy clearance is asserted.';

export function seedTarget(source) {
  const url = new URL(source.DATABASE_URL || '');
  const host = url.hostname.replace('-pooler', '');
  const local = ['127.0.0.1', 'localhost'].includes(host);
  assert.equal(source.NUTRIMIND_DEPLOYMENT_MODE, 'capstone-demo', 'Capstone demonstration mode is required.');
  assert(!source.CLINICAL_POLICY_APPROVED_VERSION, 'A clinically approved environment cannot contain these fixtures.');
  assert(
    local || (url.protocol === 'postgresql:' && url.searchParams.get('sslmode') === 'require'),
    'Remote PostgreSQL requires SSL.'
  );
  const label = `${host}:${url.port || '5432'}${url.pathname}`;
  return { label, token: createHash('sha256').update(label).digest('hex').slice(0, 20) };
}

export function seedDisposition(existing, now = new Date()) {
  if (!existing) return 'insert';
  if (existing.status === 'VERIFIED') return 'preserve-verified';
  if (existing.status === 'REJECTED') return 'preserve-rejected';
  if (existing.claimedByNutritionistId && existing.claimedAt && now - new Date(existing.claimedAt) < 30 * 60 * 1000)
    return 'preserve-claim';
  return 'update';
}

export async function seedCapstoneReviews(
  db,
  { source, confirmTarget, expectedCount, apply = false, directory, rehearsal = false }
) {
  const target = seedTarget(source);
  if (apply || rehearsal) assert.equal(confirmTarget, target.token, 'Database-target confirmation mismatch.');
  const runId = randomUUID();
  const now = new Date();
  const rollback = new Error('CAPSTONE_REHEARSAL_ROLLBACK');
  let result;
  try {
    result = await db.$transaction(
      async (tx) => {
        if (apply || rehearsal) {
          await tx.$executeRawUnsafe(
            'LOCK TABLE "RawRecipeCandidate", "MealBaseVerification" IN SHARE ROW EXCLUSIVE MODE'
          );
        }
        const reviewer = await tx.user.findUnique({
          where: { email: 'nutritionist@gmail.com' },
          select: {
            id: true,
            name: true,
            role: true,
            isSuspended: true,
            nutritionistProfile: { select: { id: true } },
          },
        });
        assert(
          reviewer?.role === 'NUTRITIONIST' && !reviewer.isSuspended && reviewer.nutritionistProfile,
          'The confirmed demo Nutritionist account is required.'
        );
        assert.equal(reviewer.name, 'Chimairel Pacaldo', 'Confirm the intended demo identity before seeding.');
        const rows = await tx.rawRecipeCandidate.findMany({
          where: {
            sourceName: 'PANLASANG_PINOY',
            status: 'AVAILABLE',
            libraryVariants: { none: { status: 'FLAGGED' } },
          },
          select: { id: true, contentSignature: true },
          orderBy: { id: 'asc' },
        });
        const previous = await tx.mealBaseVerification.findMany({
          where: { targetKind: 'RAW_RECIPE', targetId: { in: rows.map((r) => r.id) } },
        });
        const current = new Map(previous.map((r) => [`${r.targetId}:${r.revisionKey}`, r]));
        const candidates = rows
          .map((row) => ({ ...row, before: current.get(`${row.id}:${row.contentSignature}`) }))
          .filter((row) => ['insert', 'update'].includes(seedDisposition(row.before, now)));
        const summary = {
          target: target.label,
          confirmTarget: target.token,
          available: rows.length,
          toSeed: candidates.length,
          preserved: rows.length - candidates.length,
          reviewer: reviewer.name,
          simulation: true,
        };
        if (!apply && !rehearsal) return summary;
        assert.equal(candidates.length, expectedCount, 'Candidate count changed; repeat the preview.');
        if (!candidates.length) return { ...summary, inserted: 0, updated: 0, auditEvents: 0 };
        assert(directory, 'An excluded backup directory is required.');
        mkdirSync(directory, { recursive: true });
        const inserts = candidates
          .filter((r) => !r.before)
          .map((r) => ({
            id: `capstone_${randomUUID()}`,
            targetKind: 'RAW_RECIPE',
            targetId: r.id,
            revisionKey: r.contentSignature,
            status: 'VERIFIED',
            reviewedByNutritionistId: reviewer.nutritionistProfile.id,
            reviewedAt: now,
            rationale: SEED_RATIONALE,
            updatedAt: now,
          }));
        const updates = candidates.filter((r) => r.before);
        const snapshot = JSON.stringify(
          {
            runId,
            target: target.label,
            at: now.toISOString(),
            simulation: true,
            previous: updates.map((r) => r.before),
            insertIds: inserts.map((r) => r.id),
            auditIds: [`capstone_seed_${runId}`],
          },
          null,
          2
        );
        const backup = path.join(directory, `${runId}.before.json`);
        writeFileSync(backup, snapshot, { flag: 'wx', mode: 0o600 });
        const backupSha256 = createHash('sha256').update(snapshot).digest('hex');
        if (inserts.length)
          assert.equal((await tx.mealBaseVerification.createMany({ data: inserts })).count, inserts.length);
        for (const row of updates) {
          await tx.mealBaseVerification.update({
            where: { id: row.before.id },
            data: {
              status: 'VERIFIED',
              reviewedByNutritionistId: reviewer.nutritionistProfile.id,
              reviewedAt: now,
              rationale: SEED_RATIONALE,
              claimedAt: null,
              claimedByNutritionistId: null,
            },
          });
        }
        await tx.auditEvent.create({
          data: {
            id: `capstone_seed_${runId}`,
            actorName: 'Capstone fixture seeder',
            action: 'CAPSTONE_RECIPE_REVIEWS_SEEDED',
            entityType: 'MealBaseVerification',
            entityId: runId,
            metadata: {
              simulation: true,
              runId,
              reviewerProfileId: reviewer.nutritionistProfile.id,
              demoAccountUserId: reviewer.id,
              available: rows.length,
              inserted: inserts.length,
              updated: updates.length,
              backupSha256,
              rationale: SEED_RATIONALE,
              professionalReviewPerformed: false,
              patientApprovalsCreated: 0,
            },
          },
        });
        const counted = await tx.mealBaseVerification.count({
          where: {
            targetKind: 'RAW_RECIPE',
            targetId: { in: candidates.map((r) => r.id) },
            reviewedByNutritionistId: reviewer.nutritionistProfile.id,
            reviewedAt: now,
            rationale: SEED_RATIONALE,
            status: 'VERIFIED',
          },
        });
        assert.equal(counted, candidates.length, 'Seed integrity mismatch.');
        result = {
          ...summary,
          runId,
          inserted: inserts.length,
          updated: updates.length,
          auditEvents: 1,
          backup,
          backupSha256,
          rehearsal,
        };
        if (rehearsal) throw rollback;
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 15000, timeout: 120000 }
    );
  } catch (error) {
    if (error !== rollback) throw error;
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const get = (name) => {
    const i = args.indexOf(name);
    return i < 0 ? undefined : args[i + 1];
  };
  const config = get('--env-file');
  assert(config, '--env-file must explicitly select a private capstone configuration.');
  const source = config.endsWith('.json')
    ? JSON.parse(readFileSync(config, 'utf8'))
    : dotenv.parse(readFileSync(config));
  const db = new PrismaClient({ datasources: { db: { url: source.DATABASE_URL } } });
  try {
    const result = await seedCapstoneReviews(db, {
      source,
      apply: args.includes('--apply'),
      rehearsal: args.includes('--rehearse'),
      confirmTarget: get('--confirm-target'),
      expectedCount: Number(get('--expect-count')),
      directory: get('--backup-dir'),
    });
    console.log(JSON.stringify(result));
  } finally {
    await db.$disconnect();
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(
      error.code || error.name,
      error instanceof assert.AssertionError
        ? error.message
        : 'Seed failed. No partial transaction is committed. Inspect privately before retrying.'
    );
    process.exitCode = 1;
  });
}

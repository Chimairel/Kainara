/** Maintenance only. Close obsolete requests, retaining meals and all review evidence. */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { databaseTarget, assertWriteTarget } from './helpers/dev-test-account-config';
import { getStartOfManilaBusinessDay, isActiveMealReviewPeriod } from '../src/domain/meal-actionability.policy';
import { lockUserProfile } from '../src/services/profile-revision.service';

async function main() {
  dotenv.config({ path: path.resolve(__dirname, '../.env'), quiet: true });
  const args = process.argv.slice(2);
  const values = new Set(['--confirm-target', '--expect-count']);
  const switches = new Set(['--apply', '--allow-shared-development']);
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const option = args[i];
    if (options.has(option)) throw new Error('Duplicate option.');
    if (values.has(option)) {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error('Missing option value.');
      options.set(option, value);
    } else if (switches.has(option)) options.set(option, 'true');
    else throw new Error('Unknown option.');
  }
  const target = databaseTarget(process.env.DATABASE_URL ?? '', process.env);
  const apply = options.has('--apply');
  const expected = Number(options.get('--expect-count'));
  if (apply) {
    assertWriteTarget(target, args);
    if (!Number.isSafeInteger(expected) || expected < 0) throw new Error('Apply requires --expect-count from dry run.');
  }
  const now = new Date();
  const cutoff = getStartOfManilaBusinessDay(now);
  const where: Prisma.MealPlanWhereInput = {
    status: 'PENDING_REVIEW',
    OR: [
      { scheduledDate: { lt: cutoff } },
      { supersededByMealPlanId: { not: null } },
      {
        cycle: {
          OR: [
            { endDate: { lt: cutoff } },
            { supersededById: { not: null } },
            { status: { in: ['COMPLETED', 'SUPERSEDED'] } },
          ],
        },
      },
    ],
  };
  const db = new PrismaClient();
  try {
    const candidates = await db.mealPlan.findMany({ where, select: { id: true, userId: true } });
    console.log(
      JSON.stringify({
        mode: apply ? 'apply' : 'dry-run',
        target: target.label,
        confirmation: target.token,
        cutoff: cutoff.toISOString(),
        staleRequests: candidates.length,
      })
    );
    if (!apply) return;
    if (candidates.length !== expected) throw new Error('Candidate count changed. Run dry run again.');
    if (!candidates.length) {
      console.log(JSON.stringify({ closed: 0 }));
      return;
    }
    const result = await db.$transaction(
      async (tx) => {
        for (const userId of [...new Set(candidates.map((row) => row.userId))].sort())
          await lockUserProfile(tx, userId);
        const rows = await tx.mealPlan.findMany({ where, include: { cycle: true }, orderBy: { id: 'asc' } });
        if (rows.length !== expected || rows.some((row) => isActiveMealReviewPeriod(row, now)))
          throw new Error('Scope changed or an active request was selected. No updates applied.');
        const ids = new Set(candidates.map((row) => row.id));
        if (rows.some((row) => !ids.has(row.id))) throw new Error('Candidate set changed. No updates applied.');
        const snapshot = JSON.stringify(
          { schemaVersion: 1, target: target.label, capturedAt: now.toISOString(), rows },
          null,
          2
        );
        const directory = path.resolve(__dirname, '../.local/backups');
        mkdirSync(directory, { recursive: true });
        const backup = path.join(directory, `stale-meal-reviews-${now.toISOString().replace(/[:.]/g, '-')}.json`);
        writeFileSync(backup, snapshot, { flag: 'wx' });
        const sha256 = createHash('sha256').update(snapshot).digest('hex');
        const updated = await tx.mealPlan.updateMany({
          where: { AND: [where, { id: { in: rows.map((row) => row.id) } }] },
          data: { status: 'CANCELLED', claimedByNutritionistId: null, claimedAt: null },
        });
        if (updated.count !== rows.length) throw new Error('Concurrent change detected. No updates applied.');
        await tx.auditEvent.createMany({
          data: rows.map((row) => ({
            actorName: 'System maintenance',
            action: 'MEAL_PLAN_EXPIRED_REVIEW_CLOSED',
            entityType: 'MealPlan',
            entityId: row.id,
            metadata: {
              reason: 'EXPIRED_OR_SUPERSEDED_REQUEST',
              cutoff: cutoff.toISOString(),
              previousStatus: row.status,
              previousClaimedByNutritionistId: row.claimedByNutritionistId,
              previousClaimedAt: row.claimedAt?.toISOString() ?? null,
              newStatus: 'CANCELLED',
              backupSha256: sha256,
            },
          })),
        });
        return { closed: updated.count, backup, sha256 };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 60000 }
    );
    console.log(JSON.stringify(result));
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  console.error(
    'Stale-review maintenance failed. Inspect the target and dry run before retrying; no transaction is partially applied.'
  );
  process.exitCode = 1;
});

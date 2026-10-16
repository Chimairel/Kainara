/** Bounded catalogue narrowing. Defaults to read-only; never grants a review. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import prisma from '../src/lib/prisma';
import { primaryMealExclusion } from '../src/domain/recipe-category.policy';
import { lockUserProfile } from '../src/services/profile-revision.service';
import { getManilaMidnight, getManilaDateKey } from '../src/domain/meal-plan-cycle.policy';

async function main() {
  const args = process.argv.slice(2), option = (key: string) => args[args.indexOf(key) + 1];
  const target = new URL(process.env.DATABASE_URL!);
  assert(args.includes('--expect-host') && args.includes('--expect-database'), 'Explicit database identity is required.');
  assert.equal(target.hostname, option('--expect-host')); assert.equal(target.pathname.slice(1), option('--expect-database'));
  const local = ['127.0.0.1', 'localhost'].includes(target.hostname);
  assert(local || args.includes('--staging') && target.hostname === 'ep-delicate-salad-azlnzuyu.c-3.ap-southeast-1.aws.neon.tech' &&
    target.pathname === '/neondb', 'Only loopback or the confirmed isolated staging database is supported.');
  const [library, raw] = await Promise.all([
    prisma.mealLibrary.findMany({ select: { id: true, mealName: true, applicableMealTypes: true } }),
    prisma.rawRecipeCandidate.findMany({ select: { id: true, recipeName: true, category: true, applicableMealTypes: true } }),
  ]);
  const changes = [
    ...library.filter(row => primaryMealExclusion(row.mealName) && row.applicableMealTypes.some(t => t.mealType !== 'SNACK'))
      .map(row => ({ kind: 'library', id: row.id, name: row.mealName, reason: primaryMealExclusion(row.mealName)!, previous: row.applicableMealTypes })),
    ...raw.filter(row => primaryMealExclusion(row.recipeName, row.category) && row.applicableMealTypes.some(t => t.mealType !== 'SNACK'))
      .map(row => ({ kind: 'raw', id: row.id, name: row.recipeName, reason: primaryMealExclusion(row.recipeName, row.category)!, previous: row.applicableMealTypes })),
  ];
  assert(changes.length <= 5000, 'Reconciliation exceeds its bounded catalogue scope.');
  const now = new Date(), day = getManilaMidnight(getManilaDateKey(now));
  const future = await prisma.mealPlan.findMany({ where: { scheduledDate: { gte: day }, status: { in: ['APPROVED', 'PENDING_REVIEW'] },
    supersededByMealPlanId: null, mealLogs: { none: { status: { in: ['DONE', 'SKIPPED'] } } },
    cycle: { status: { notIn: ['SUPERSEDED', 'COMPLETED'] } } },
    select: { id: true, userId: true, mealName: true, mealType: true, planGroupId: true, status: true } });
  const affected = future.filter(row => row.mealType !== 'SNACK' && primaryMealExclusion(row.mealName));
  assert(affected.length <= 1000, 'Reconciliation exceeds its bounded future-meal scope.');
  const summary = { catalogue: { library: library.length, raw: raw.length }, classificationChanges: changes.length,
    futureSlots: affected.length, sample: changes.slice(0, 12).map(({name, reason}) => ({name, reason})) };
  console.log(JSON.stringify(summary));
  if (!args.includes('--apply')) return;
  assert(args.includes('--expected-count')); assert.equal(changes.length + affected.length, Number(option('--expected-count')));
  assert(args.includes('--receipt'), 'Private rollback receipt path required.');
  writeFileSync(option('--receipt'), JSON.stringify({ at: now.toISOString(), host: target.hostname, database: target.pathname.slice(1), changes, affected }, null, 2), { flag: 'wx' });
  for (const change of changes) await prisma.$transaction(async tx => {
    if (change.kind === 'library') await tx.mealLibraryApplicableType.deleteMany({ where: { mealLibraryId: change.id, mealType: { not: 'SNACK' } } });
    else await tx.rawRecipeApplicableType.deleteMany({ where: { rawRecipeCandidateId: change.id, mealType: { not: 'SNACK' } } });
    await tx.auditEvent.create({ data: { action: 'PRIMARY_MEAL_CLASSIFICATION_NARROWED', entityType: change.kind === 'library' ? 'MealLibrary' : 'RawRecipeCandidate', entityId: change.id,
      metadata: { reason: change.reason, priorTypes: change.previous.map(t => t.mealType), policy: 'FOOD_CHOICES_V2' } } });
  });
  for (const userId of [...new Set(affected.map(row => row.userId))]) await prisma.$transaction(async tx => {
    await lockUserProfile(tx, userId);
    const ids = affected.filter(row => row.userId === userId).map(row => row.id);
    const removed = await tx.mealPlan.updateMany({ where: { id: { in: ids }, userId, status: { in: ['APPROVED', 'PENDING_REVIEW'] },
      mealLogs: { none: { status: { in: ['DONE', 'SKIPPED'] } } } }, data: { status: 'CANCELLED', requiresSafetyRevalidation: true,
      claimedAt: null, claimedByNutritionistId: null } });
    const cycles = [...new Set(affected.filter(row => row.userId === userId).map(row => row.planGroupId))];
    await tx.groceryList.updateMany({ where: { userId, planGroupId: { in: cycles } }, data: { isStale: true } });
    await tx.auditEvent.create({ data: { action: 'NON_MEAL_FUTURE_SLOTS_WITHDRAWN', entityType: 'User', entityId: userId,
      metadata: { count: removed.count, mealIds: ids, cycleIds: cycles, reason: 'PRIMARY_MEAL_CLASSIFICATION' } } });
  });
  // Existing partial-plan worker detects these gaps and uses its normal,
  // idempotent generation/review workflow. No provider call or approval here.
  console.log(JSON.stringify({ applied: true, ...summary }));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Reconciliation failed'); process.exitCode = 1; }).finally(() => prisma.$disconnect());

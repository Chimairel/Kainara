/** Real history SQL against a fresh synthetic database in the owned loopback container. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';

async function main() {
  const root = resolve(__dirname, '../..');
  const container = 'kainara-local-postgres';
  const docker = (args: string[], input?: string) => execFileSync('docker', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  const inspected = JSON.parse(docker(['inspect', container]))[0];
  assert.equal(inspected.Config.Labels['com.docker.compose.project'], 'kainara-local-development');
  assert.deepEqual(inspected.HostConfig.PortBindings['5432/tcp'], [{ HostIp: '127.0.0.1', HostPort: '55432' }]);
  const database = `kainara_meal_approvals_${randomBytes(4).toString('hex')}`;
  assert.match(database, /^kainara_meal_approvals_[a-f0-9]{8}$/);
  const password = parse(readFileSync(resolve(root, 'backend/.local/local-development/postgres.env'))).LOCAL_POSTGRES_PASSWORD;
  assert.match(password, /^[a-f0-9]{64}$/);
  const url = `postgresql://postgres:${password}@127.0.0.1:55432/${database}?schema=public`;
  Object.assign(process.env, { DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test' });
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  const ddl = execFileSync(process.execPath, [resolve(root, 'backend/node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', resolve(root, 'backend/prisma/schema.prisma'), '--script'], { cwd: resolve(root, 'backend'), env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], ddl);
  const { default: db } = await import('../src/lib/prisma');
  const { NutritionistAuditService } = await import('../src/services/nutritionist-audit.service');
  const { StaffAuditService } = await import('../src/services/staff-audit.service');
  try {
    const user = await db.user.create({ data: { name: 'Synthetic reviewer', email: 'meal-audit@example.invalid', passwordHash: 'unused', role: 'NUTRITIONIST' } });
    const reviewer = await db.nutritionistProfile.create({ data: { userId: user.id, prcLicenseNumber: 'synthetic-approval-audit', prcLicenseExpiry: new Date('2099-01-01'), isVerified: true } });
    const food = { mealName: 'Synthetic meal', mealType: 'LUNCH' as const, calories: 450, proteinG: 25, carbsG: 45, fatG: 15 };
    const rootMeal = await db.mealLibrary.create({ data: food });
    const variant = await db.mealLibrary.create({ data: { ...food, recipeFamilyId: rootMeal.id } });
    const otherMeal = await db.mealLibrary.create({ data: { ...food, mealName: 'Other synthetic meal' } });
    const now = new Date('2026-10-13T08:00:00Z');
    const cycle = await db.mealPlanCycle.create({ data: { id: 'fixture-cycle', userId: user.id, planType: 'WEEKLY', startDate: now, endDate: now, preparationOpensAt: now, shoppingDeadlineAt: now, expectedSlotCount: 3 } });
    const expected: string[] = [];
    for (const [index, savedId, decisionValue] of [[0, rootMeal.id, 'APPROVE'], [1, variant.id, 'APPROVE'], [2, rootMeal.id, 'REJECT'], [3, otherMeal.id, 'APPROVE']] as const) {
      // Deliberately change the current meal identity. The saved decision is authoritative.
      const plan = await db.mealPlan.create({ data: { ...food, planGroupId: cycle.id, userId: user.id, libraryMealId: otherMeal.id, scheduledDate: now } });
      const decision = await db.mealPlanReviewDecision.create({ data: { mealPlanId: plan.id, nutritionistProfileId: reviewer.id, stage: 'PRIMARY', decision: decisionValue, evidenceSnapshot: index === 1 ? { mealName: 'Saved serving', reviewContext: { meal: { libraryMealId: savedId } } } : { mealName: 'Saved meal', libraryMealId: savedId } } });
      const event = await db.auditEvent.create({ data: { actorUserId: user.id, actorRole: 'NUTRITIONIST', action: decisionValue === 'APPROVE' ? 'MEAL_PLAN_APPROVED' : 'MEAL_PLAN_REJECTED', entityType: 'MealPlan', entityId: plan.id, metadata: { reviewDecisionId: decision.id }, createdAt: new Date(now.getTime() + index * 1000) } });
      if (index < 2) expected.push(event.id);
    }
    const profileApproval = await db.mealLibraryProfileApproval.create({ data: { mealLibraryId: variant.id, safetyScopeKey: 'a'.repeat(64), recipeSignature: 'b'.repeat(64), evidenceRevision: 1, reviewerNutritionistId: reviewer.id, reviewPolicyVersion: 'SYNTHETIC', sourceProvenance: 'CERTIFIED_LIBRARY' } });
    const profileEvent = await db.auditEvent.create({ data: { actorUserId: user.id, actorRole: 'NUTRITIONIST', action: 'MEAL_APPROVAL_RECHECKED', entityType: 'MealLibraryProfileApproval', entityId: profileApproval.id } });
    expected.push(profileEvent.id);
    await db.auditEvent.createMany({ data: ['BASE_MEAL_VERIFIED', 'MEAL_BASE_FLAGGED', 'RND_REVIEW_SAVED_CONTEXT_ACCESSED'].map(action => ({ actorRole: 'NUTRITIONIST' as const, actorName: 'Synthetic reviewer', action, entityType: 'MealLibrary', entityId: rootMeal.id })) });
    const filters = { view: 'nutritionist' as const, approvalActionsOnly: true, recipeCase: { libraryIds: [rootMeal.id, variant.id], sourceId: null }, limit: 2 };
    const first = await StaffAuditService.history(filters, db);
    const second = await StaffAuditService.history({ ...filters, page: 2 }, db);
    assert.equal(first.total, 3); assert.equal(first.totalPages, 2);
    assert.deepEqual(new Set([...first.rows, ...second.rows].map(row => row.id)), new Set(expected));
    const service = await NutritionistAuditService.recipeCases(variant.id, 1, db, true);
    assert.deepEqual(new Set(service.rows.map(row => row.id)), new Set(expected));
    assert.equal((await NutritionistAuditService.recipeCases(rootMeal.id, 1, db)).total, 3); // old case history includes rejection, not reusable events
    assert.equal(await db.auditEvent.count(), 8);
    console.log('PASS: approval-only SQL filters before counts/paging, includes serving family and reusable rechecks, excludes unrelated/negative/access events, and follows saved identity after current meal changes. All records retained in owned loopback fixture.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error : 'Local meal approval audit acceptance failed; no hosted target was used.'); process.exitCode = 1; });

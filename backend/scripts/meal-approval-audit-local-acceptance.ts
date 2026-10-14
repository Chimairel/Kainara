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
  Object.assign(process.env, { DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test', CLINICAL_CLARIFICATIONS_ENABLED: 'true' });
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  const ddl = execFileSync(process.execPath, [resolve(root, 'backend/node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', resolve(root, 'backend/prisma/schema.prisma'), '--script'], { cwd: resolve(root, 'backend'), env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], ddl);
  const { default: db } = await import('../src/lib/prisma');
  const { NutritionistAuditService } = await import('../src/services/nutritionist-audit.service');
  const { StaffAuditService } = await import('../src/services/staff-audit.service');
  const { recordedReviewConditionsSql } = await import('../src/domain/recorded-review-conditions.sql');
  const { Prisma } = await import('@prisma/client');
  try {
    const user = await db.user.create({ data: { name: 'Synthetic reviewer', email: 'meal-audit@example.invalid', passwordHash: 'unused', role: 'NUTRITIONIST', emailVerified: true } });
    const reviewer = await db.nutritionistProfile.create({ data: { userId: user.id, prcLicenseNumber: 'synthetic-approval-audit', prcLicenseExpiry: new Date('2099-01-01'), isVerified: true } });
    const food = { mealName: 'Synthetic meal', mealType: 'LUNCH' as const, calories: 450, proteinG: 25, carbsG: 45, fatG: 15 };
    const rootMeal = await db.mealLibrary.create({ data: food });
    const variant = await db.mealLibrary.create({ data: { ...food, recipeFamilyId: rootMeal.id } });
    const otherMeal = await db.mealLibrary.create({ data: { ...food, mealName: 'Other synthetic meal' } });
    const now = new Date('2026-10-13T08:00:00Z');
    const cycle = await db.mealPlanCycle.create({ data: { id: 'fixture-cycle', userId: user.id, planType: 'WEEKLY', startDate: now, endDate: now, preparationOpensAt: now, shoppingDeadlineAt: now, expectedSlotCount: 3 } });
    const expected: string[] = [];
    let sourceDecisionId = '';
    for (const [index, savedId, decisionValue] of [[0, rootMeal.id, 'APPROVE'], [1, variant.id, 'APPROVE'], [2, rootMeal.id, 'REJECT'], [3, otherMeal.id, 'APPROVE']] as const) {
      // Deliberately change the current meal identity. The saved decision is authoritative.
      const plan = await db.mealPlan.create({ data: { ...food, planGroupId: cycle.id, userId: user.id, libraryMealId: otherMeal.id, scheduledDate: now } });
      const decision = await db.mealPlanReviewDecision.create({ data: { mealPlanId: plan.id, nutritionistProfileId: reviewer.id, stage: 'PRIMARY', decision: decisionValue, evidenceSnapshot: index === 1
        ? { mealName: 'Saved serving', recordedProfile: { conditions: ['DIABETES'] }, reviewContext: { meal: { libraryMealId: savedId }, clinical: { conditions: ['HEART_CONDITION'], healthDetails: 'PRIVATE_CLINICAL' } } }
        : { mealName: 'Saved meal', libraryMealId: savedId, recordedProfile: { conditions: ['HEART_CONDITION', 'DIABETES'], age: 57 }, rationale: 'PRIVATE_NOTE' } } });
      if (index === 0) sourceDecisionId = decision.id;
      const event = await db.auditEvent.create({ data: { actorUserId: user.id, actorRole: 'NUTRITIONIST', action: decisionValue === 'APPROVE' ? 'MEAL_PLAN_APPROVED' : 'MEAL_PLAN_REJECTED', entityType: 'MealPlan', entityId: plan.id, metadata: { reviewDecisionId: decision.id }, createdAt: new Date(now.getTime() + index * 1000) } });
      if (index < 2) expected.push(event.id);
    }
    const profileApproval = await db.mealLibraryProfileApproval.create({ data: { mealLibraryId: variant.id, safetyScopeKey: 'a'.repeat(64), recipeSignature: 'b'.repeat(64), evidenceRevision: 1, reviewerNutritionistId: reviewer.id, reviewPolicyVersion: 'SYNTHETIC', sourceProvenance: 'CERTIFIED_LIBRARY', scopeSnapshot: { conditions: [] } } });
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
    const heart = await StaffAuditService.history({ ...filters, condition: 'HEART_CONDITION', limit: 1 }, db);
    const heartNext = await StaffAuditService.history({ ...filters, condition: 'HEART_CONDITION', limit: 1, page: 2 }, db);
    assert.equal(heart.total, 2); assert.equal(heart.totalPages, 2);
    assert.equal(heart.rows.length, 1); assert.notEqual(heart.rows[0].id, heartNext.rows[0].id);
    assert.equal((await NutritionistAuditService.recipeCases(rootMeal.id, 1, db, true, 'DIABETES')).total, 1);
    assert.deepEqual((await NutritionistAuditService.recipeCases(rootMeal.id, 1, db, true, 'NONE')).rows.map(row => row.id), [profileEvent.id]);
    assert.equal((await NutritionistAuditService.recipeCases(rootMeal.id, 1, db, true, 'UNRECORDED')).total, 0);
    assert(!/PRIVATE_|healthDetails|age/.test(JSON.stringify(service.rows)));
    const reference = await db.mealReviewReference.create({ data: { decisionId: sourceDecisionId, policyVersion: 'EXACT_REVIEW_APPROVAL_V2', contextKey: 'c'.repeat(64), servingKey: 'd'.repeat(64), plateFacts: {} } });
    const reused = await db.auditEvent.create({ data: { actorName: 'Kainara', action: 'MEAL_APPROVAL_REUSED', entityType: 'MealPlan', entityId: 'synthetic-reused-plan', metadata: { referenceId: reference.id, libraryMealId: rootMeal.id } } });
    const withReuse = await NutritionistAuditService.recipeCases(rootMeal.id, 1, db, true, 'HEART_CONDITION');
    assert.equal(withReuse.total, 3);
    assert.deepEqual(withReuse.rows.find(row => row.id === reused.id)?.conditionCodes, ['DIABETES', 'HEART_CONDITION']);
    for (const [snapshot, expectedCodes] of [
      [{}, null], [{ recordedProfile: { conditions: null } }, null], [{ conditions: [] }, []],
      [{ conditions: ['NONE'] }, []], [{ conditions: ['PRIVATE_CUSTOM'] }, null],
      [{ conditions: ['HEART_CONDITION', 'PRIVATE_CUSTOM', 'HEART_CONDITION'] }, ['HEART_CONDITION']],
      [{ reviewContext: { clinical: { conditions: [] } }, recordedProfile: { conditions: ['DIABETES'] } }, []],
    ] as const) {
      const result = await db.$queryRaw<Array<{ codes: unknown }>>(Prisma.sql`SELECT ${recordedReviewConditionsSql(Prisma.sql`${JSON.stringify(snapshot)}::jsonb`)} AS codes`);
      assert.deepEqual(result[0].codes, expectedCodes);
    }
    const { flagCaseApproval, caseApprovalFlagContext, resolveCaseApprovalFlag, caseApprovalConcern, listCaseApprovalFlags } = await import('../src/services/case-approval-flag.service');
    const { ReviewRoutingService } = await import('../src/services/review-routing.service');
    const { NutritionistAuditContextService } = await import('../src/services/nutritionist-audit-context.service');
    const makeRnd = async (label: string) => {
      const actor = await db.user.create({ data: { name: `Synthetic ${label}`, email: `${label}@example.invalid`, passwordHash: 'unused', role: 'NUTRITIONIST', emailVerified: true } });
      const rnd = await db.nutritionistProfile.create({ data: { userId: actor.id, prcLicenseNumber: `synthetic-${label}`, prcLicenseExpiry: new Date('2099-01-01'), isVerified: true } });
      return { actor, rnd };
    };
    const flagger = await makeRnd('flagger'), resolver = await makeRnd('resolver');
    const nextDate = new Date(Date.now() + 86400000);
    await db.mealPlanCycle.update({ where: { id: cycle.id }, data: { endDate: new Date(Date.now() + 7 * 86400000) } });
    const source = await db.mealPlanReviewDecision.findUniqueOrThrow({ where: { id: sourceDecisionId } });
    const immutableBefore = JSON.stringify(source.evidenceSnapshot);
    await db.mealPlan.update({ where: { id: source.mealPlanId }, data: { status: 'APPROVED', requiresSafetyRevalidation: false, scheduledDate: nextDate } });
    const reusedPlan = await db.mealPlan.create({ data: { ...food, userId: user.id, planGroupId: cycle.id, libraryMealId: rootMeal.id,
      scheduledDate: nextDate, status: 'APPROVED', requiresSafetyRevalidation: false,
      selectionEvidence: { exactApprovalReuse: { referenceId: reference.id } } } });
    const untouched = await db.mealPlan.create({ data: { ...food, userId: user.id, planGroupId: cycle.id, libraryMealId: rootMeal.id,
      scheduledDate: nextDate, status: 'APPROVED', requiresSafetyRevalidation: false } });
    const independentlyReviewed = await db.mealPlan.create({ data: { ...food, userId: user.id, planGroupId: cycle.id, libraryMealId: rootMeal.id,
      scheduledDate: nextDate, status: 'APPROVED', requiresSafetyRevalidation: false,
      selectionEvidence: { exactApprovalReuse: { referenceId: reference.id } } } });
    await db.mealPlanReviewDecision.create({ data: { mealPlanId: independentlyReviewed.id, nutritionistProfileId: resolver.rnd.id, stage: 'PRIMARY', decision: 'APPROVE',
      evidenceSnapshot: { mealName: 'Independent new approval' } } });
    const coalescedPlan = await db.mealPlan.create({ data: { ...food, userId: user.id, planGroupId: cycle.id, libraryMealId: rootMeal.id,
      scheduledDate: nextDate, status: 'APPROVED', requiresSafetyRevalidation: false } });
    await db.mealPlanReviewDecision.create({ data: { mealPlanId: coalescedPlan.id, nutritionistProfileId: reviewer.id, stage: 'PRIMARY', decision: 'APPROVE',
      evidenceSnapshot: { coalescedFromMealPlanId: source.mealPlanId } } });
    const notes = { category: 'NUTRITION' as const, affectedFields: ['sodium'], explanation: 'Recorded sodium needs an independent review.', reference: 'Synthetic measured evidence.', proposedCorrection: 'Recheck measured sodium amounts.' };
    const initial = await caseApprovalFlagContext(db, sourceDecisionId);
    await assert.rejects(flagCaseApproval(flagger.actor.id, flagger.rnd.id, sourceDecisionId, { notes, expectedVersion: 'a'.repeat(64) }, db), { statusCode: 409 });
    assert.deepEqual(await flagCaseApproval(flagger.actor.id, flagger.rnd.id, sourceDecisionId, { notes, expectedVersion: initial.expectedVersion }, db), { affectedMeals: 3 });
    await assert.rejects(flagCaseApproval(flagger.actor.id, flagger.rnd.id, sourceDecisionId, { notes, expectedVersion: initial.expectedVersion }, db), { statusCode: 409 });
    for (const id of [source.mealPlanId, reusedPlan.id, coalescedPlan.id]) {
      const plan = await db.mealPlan.findUniqueOrThrow({ where: { id } });
      assert.equal(plan.status, 'PENDING_REVIEW'); assert.equal(plan.requiresSafetyRevalidation, true);
      assert.equal(plan.claimedByNutritionistId, null);
    }
    for (const id of [untouched.id, independentlyReviewed.id]) assert.equal((await db.mealPlan.findUniqueOrThrow({ where: { id } })).status, 'APPROVED');
    assert.equal((await db.mealLibrary.findUniqueOrThrow({ where: { id: rootMeal.id } })).status, rootMeal.status);
    await assert.rejects(ReviewRoutingService.assertMeal(reviewer.id, reusedPlan.id, db), { statusCode: 403 });
    await assert.rejects(ReviewRoutingService.assertMeal(flagger.rnd.id, reusedPlan.id, db), { statusCode: 403 });
    await ReviewRoutingService.assertMeal(resolver.rnd.id, reusedPlan.id, db);
    assert.equal((await listCaseApprovalFlags(resolver.rnd.id, db)).length, 1);
    const concern = (await caseApprovalConcern(db, reusedPlan.id))[0];
    assert.deepEqual(concern.notes, notes); assert.equal(concern.active, true);
    const resolution = { mealPlanId: reusedPlan.id, expectedVersion: concern.expectedVersion, rationale: 'Independent measured evidence resolves this recorded concern.' };
    await assert.rejects(resolveCaseApprovalFlag(resolver.actor.id, resolver.rnd.id, sourceDecisionId, resolution, db), { statusCode: 409 });
    await assert.rejects(resolveCaseApprovalFlag(user.id, reviewer.id, sourceDecisionId, resolution, db), { statusCode: 403 });
    await assert.rejects(resolveCaseApprovalFlag(flagger.actor.id, flagger.rnd.id, sourceDecisionId, resolution, db), { statusCode: 403 });
    await db.mealPlan.update({ where: { id: reusedPlan.id }, data: { claimedByNutritionistId: resolver.rnd.id, claimedAt: new Date() } });
    assert.deepEqual(await resolveCaseApprovalFlag(resolver.actor.id, resolver.rnd.id, sourceDecisionId, resolution, db), { resolved: true });
    assert.equal((await db.mealPlan.findUniqueOrThrow({ where: { id: reusedPlan.id } })).status, 'PENDING_REVIEW');
    const resolved = (await caseApprovalConcern(db, reusedPlan.id))[0];
    assert.equal(resolved.active, false); assert.equal(resolved.resolution, resolution.rationale);
    assert.deepEqual(resolved.notes, notes);
    assert.equal(JSON.stringify((await db.mealPlanReviewDecision.findUniqueOrThrow({ where: { id: sourceDecisionId } })).evidenceSnapshot), immutableBefore);
    assert.equal((await listCaseApprovalFlags(resolver.rnd.id, db)).length, 0);
    const history = await StaffAuditService.history({ view: 'nutritionist', limit: 100 }, db);
    for (const action of ['MEAL_APPROVAL_FLAGGED', 'MEAL_CASE_FLAG_RESOLVED']) {
      const row = history.rows.find(row => row.actionCode === action)!;
      assert.equal(row.type, 'Meal approval'); assert.deepEqual(row.conditionCodes, ['DIABETES', 'HEART_CONDITION']);
      const saved = await NutritionistAuditContextService.detail(resolver.actor.id, resolver.rnd.id, row.id, db);
      assert.deepEqual(saved.reviewedSnapshot, source.evidenceSnapshot);
      assert.equal(saved.currentProfile, null); assert.deepEqual(saved.clinicalEvidence, []);
      assert.deepEqual((saved.recordedConcern as { notes: unknown }).notes, notes);
    }
    console.log('PASS: real SQL approval flag affects source and exact reuse only; stale/repeated flags blocked; verifier and flagger locked; independent claim required; resolution retains reasons without approving; immutable full context and condition audit verified.');
    console.log('PASS: saved condition filtering occurs before pagination; missing and absent conditions differ; exact reuse resolves original conditions; only built-in codes leave SQL.');
    console.log('PASS: approval-only SQL filters before counts/paging, includes serving family and reusable rechecks, excludes unrelated/negative/access events, and follows saved identity after current meal changes. All records retained in owned loopback fixture.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error : 'Local meal approval audit acceptance failed; no hosted target was used.'); process.exitCode = 1; });

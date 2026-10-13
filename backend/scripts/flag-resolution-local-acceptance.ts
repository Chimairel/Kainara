/** Synthetic HTTP/SQL acceptance; refuses shared/local normal-use databases. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Role } from '@prisma/client';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { MEAL_LIBRARY_SAFETY_POLICY_VERSION } from '../src/domain/meal-library-safety-evidence.policy';
import { mealPlanFlagContext, assertPlanFlagConcernsResolved } from '../src/services/meal-plan-flag-context.service';
import { ConditionClearanceService } from '../src/services/condition-clearance.service';

async function main() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55432');
  assert.equal(url.pathname, '/kainara_flag_resolution_20261013');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  assert.equal(await prisma.user.count(), 0, 'Requires an empty task-owned fixture.');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/nutritionist`;
  const users = [];
  for (let index = 0; index < 4; index++) {
    const user = await prisma.user.create({
      data: {
        role: 'NUTRITIONIST',
        name: `Synthetic RND ${index}`,
        email: `flag-resolution-${index}@example.invalid`,
        passwordHash: 'unusable-fixture',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      },
    });
    const profile = await prisma.nutritionistProfile.create({
      data: {
        userId: user.id,
        isVerified: true,
        prcLicenseNumber: `SYNTHETIC-FLAG-${index}`,
        prcLicenseExpiry: new Date('2099-01-01'),
      },
    });
    users.push({ user, profile });
  }
  const request = async (index: number, path: string, body?: unknown) => {
    const user = users[index].user;
    const response = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${signAccessToken({ userId: user.id, email: user.email, role: user.role as Role })}`,
        'Content-Type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json()) as { data: any; error?: string } };
  };
  const ok = async (value: ReturnType<typeof request>) => {
    const result = await value;
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body.data;
  };
  try {
    const food = await prisma.foodItem.create({
      data: {
        name: 'Synthetic measured squash',
        category: 'Vegetables',
        source: 'FNRI',
        calories: 200,
        proteinG: 10,
        carbsG: 20,
        fatG: 5,
      },
    });
    const meal = await prisma.mealLibrary.create({
      data: {
        mealName: 'Synthetic flag resolution plate',
        mealType: 'LUNCH',
        calories: 400,
        proteinG: 20,
        carbsG: 60,
        fatG: 10,
        description: 'Cook measured ingredients and serve one measured portion.',
        status: 'APPROVED',
        recipeSignature: 'a'.repeat(64),
        safetyEvidenceRevision: 1,
        certifiedEvidenceRevision: 1,
        safetyEvidenceStatus: 'COMPLETE',
        safetyEvidenceOrigin: 'NUTRITIONIST_REVIEW',
        safetyPolicyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
        safetyReviewedByNutritionistId: users[0].profile.id,
        nutritionEvidenceSource: 'FNRI_RECONCILED',
        nutritionServingDescription: 'One measured test bowl',
        riceRole: 'STANDALONE',
        riceRoleReviewStatus: 'REVIEWED',
        ingredients: {
          create: {
            ingredientName: food.name,
            foodItemId: food.id,
            quantity: 100,
            unit: 'g',
            dataSource: 'FNRI',
            position: 0,
          },
        },
      },
    });
    const approval = await prisma.mealLibraryProfileApproval.create({
      data: {
        mealLibraryId: meal.id,
        safetyScopeKey: 'b'.repeat(64),
        recipeSignature: meal.recipeSignature!,
        evidenceRevision: 1,
        reviewerNutritionistId: users[0].profile.id,
        reviewPolicyVersion: 'synthetic-test',
        sourceProvenance: 'CERTIFIED_LIBRARY',
        reviewDueAt: new Date('2099-01-01'),
        scopeSnapshot: { conditions: ['HYPERTENSION'], allergens: [] },
      },
    });
    const member = await prisma.user.create({
      data: {
        name: 'Synthetic member',
        email: 'flag-member@example.invalid',
        passwordHash: 'unusable-fixture',
        role: 'USER',
      },
    });
    const cycle = await prisma.mealPlanCycle.create({
      data: {
        id: randomUUID(),
        userId: member.id,
        planType: 'WEEKLY',
        startDate: new Date('2090-01-01'),
        endDate: new Date('2090-01-07'),
        preparationOpensAt: new Date('2089-12-28'),
        shoppingDeadlineAt: new Date('2090-01-01'),
        expectedSlotCount: 1,
      },
    });
    const plan = await prisma.mealPlan.create({
      data: {
        userId: member.id,
        planGroupId: cycle.id,
        libraryMealId: meal.id,
        profileApprovalId: approval.id,
        mealName: meal.mealName,
        mealType: 'LUNCH',
        calories: 400,
        proteinG: 20,
        carbsG: 60,
        fatG: 10,
        scheduledDate: new Date('2090-01-01'),
        status: 'APPROVED',
      },
    });
    const recipe = await ok(request(1, `/meal-review-cases/${meal.id}`));
    const notes = {
      category: 'NUTRITION',
      affectedFields: ['sodiumMg'],
      explanation: 'Recheck the measured sodium values for this exact approval.',
      reference: 'Synthetic recorded composition evidence.',
      proposedCorrection: 'Reconcile ingredient grams against the recorded source.',
    };
    const flag = (kind: 'PROFILE' | 'CONDITION', id: string) =>
      ok(
        request(1, `/library/${meal.id}/approvals/flag`, {
          kind,
          approvalId: id,
          expectedVersion: recipe.recipeVersion,
          notes,
        })
      );
    await flag('PROFILE', approval.id);
    const detail = await ok(request(2, `/library/${meal.id}/approvals/PROFILE/${approval.id}`));
    assert.equal(detail.flagReview.concern.notes.explanation, notes.explanation);
    assert.equal(detail.flagReview.canResolve, true);
    assert.equal(
      (await ok(request(0, `/library/${meal.id}/approvals/PROFILE/${approval.id}`))).flagReview.canResolve,
      false
    );
    const command = {
      kind: 'PROFILE',
      expectedVersion: detail.flagReview.expectedVersion,
      resolved: true,
      rationale: 'Checked recorded ingredient grams and reconciled the sodium source.',
    };
    const endpoint = `/library/${meal.id}/approvals/${approval.id}/recheck`;
    assert.equal((await request(2, endpoint, { ...command, resolved: false })).status, 400);
    assert.equal((await request(2, endpoint, { ...command, rationale: 'checked' })).status, 400);
    assert.equal((await request(0, endpoint, command)).status, 403);
    assert.equal((await request(1, endpoint, command)).status, 403);
    await assert.rejects(
      prisma.$transaction((tx) => assertPlanFlagConcernsResolved(tx, plan.id)),
      /Resolve the linked/
    );
    console.log('PASS exact concern, required written resolution, independent reviewer and member approval gate');
    await prisma.mealLibraryProfileApproval.update({
      where: { id: approval.id },
      data: { flagReason: 'Changed concern requires a new current review.' },
    });
    assert.equal((await request(2, endpoint, command)).status, 409);
    const current = await ok(request(2, `/library/${meal.id}/approvals/PROFILE/${approval.id}`));
    await ok(request(2, endpoint, { ...command, expectedVersion: current.flagReview.expectedVersion }));
    assert.equal(
      (await request(2, endpoint, { ...command, expectedVersion: current.flagReview.expectedVersion })).status,
      409
    );
    const saved = await prisma.mealLibraryProfileApproval.findUniqueOrThrow({ where: { id: approval.id } });
    assert.equal(saved.flaggedAt, null);
    assert.equal(saved.reviewerNutritionistId, users[2].profile.id);
    const audit = await prisma.auditEvent.findFirstOrThrow({
      where: { entityId: approval.id, action: 'MEAL_APPROVAL_RECHECKED' },
    });
    assert.equal((audit.metadata as any).rationale, command.rationale);
    const visible = await mealPlanFlagContext(prisma, plan.id);
    assert.equal(visible[0].resolution, command.rationale);
    assert.equal(visible[0].active, false);
    const held = await prisma.mealPlan.findUniqueOrThrow({ where: { id: plan.id } });
    assert.equal(held.requiresSafetyRevalidation, true);
    assert.equal(held.status, 'APPROVED');
    console.log(
      'PASS changed version, duplicate rejection, saved resolution visible to another RND and preserved member hold'
    );
    await prisma.mealLibraryProfileApproval.update({
      where: { id: approval.id }, data: { reviewDueAt: new Date('2020-01-01') },
    });
    const due = await ok(request(2, `/library/${meal.id}/approvals/PROFILE/${approval.id}`));
    await ok(request(2, endpoint, { ...command, expectedVersion: due.flagReview.expectedVersion }));
    assert.ok((await prisma.mealLibraryProfileApproval.findUniqueOrThrow({ where: { id: approval.id } })).reviewDueAt > new Date());
    console.log('PASS overdue approval recheck renews the existing annual review date');
    const clearance = await prisma.mealConditionClearance.create({
      data: {
        mealLibraryId: meal.id,
        condition: 'HYPERTENSION',
        recipeSignature: meal.recipeSignature!,
        evidenceRevision: 1,
        policyVersion: MEAL_LIBRARY_SAFETY_POLICY_VERSION,
        assuranceTier: 'STANDARD',
        provenance: 'MANUAL_REVIEW',
        state: 'ACTIVE',
        activatedAt: new Date(),
        resolvedByNutritionistId: users[0].profile.id,
        evidenceSnapshot: {},
      },
    });
    await flag('CONDITION', clearance.id);
    await assert.rejects(
      ConditionClearanceService.submitManualDecision({
        nutritionistProfileId: users[2].profile.id,
        mealLibraryId: meal.id,
        condition: 'HYPERTENSION',
        decision: 'APPROVE',
        rationale: command.rationale,
      }),
      /recorded flag recheck/
    );
    const condition = await ok(request(2, `/library/${meal.id}/approvals/CONDITION/${clearance.id}`));
    await ok(
      request(2, `/library/${meal.id}/approvals/${clearance.id}/recheck`, {
        ...command,
        kind: 'CONDITION',
        expectedVersion: condition.flagReview.expectedVersion,
      })
    );
    const active = await prisma.mealConditionClearance.findUniqueOrThrow({
      where: { id: clearance.id },
      include: { decisions: true },
    });
    assert.equal(active.state, 'ACTIVE');
    assert.equal(active.resolvedByNutritionistId, users[2].profile.id);
    assert.equal(active.decisions[0].rationale, command.rationale);
    assert.equal(await prisma.mealConditionClearance.count({ where: { mealLibraryId: meal.id } }), 1);
    console.log(
      'PASS suspended condition cannot bypass resolution; exact clearance, written note and new reviewer retained'
    );
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

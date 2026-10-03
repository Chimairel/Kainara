import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/lib/prisma';
import { AdminService } from '../src/services/admin.service';

test('revoking professional access removes sessions and active claims while preserving review history', async () => {
  const original = {
    transaction: prisma.$transaction,
    user: prisma.user.findUnique,
    clearances: prisma.mealConditionClearance.findMany,
    policies: prisma.conditionRulePolicyVersion.findMany,
  };
  const changes: Array<{ model: string; args: any }> = [];
  const release = (model: string) => ({
    updateMany: async (args: any) => {
      changes.push({ model, args });
      return { count: 1 };
    },
  });
  const tx = {
    user: { update: async ({ data }: any) => ({ id: 'account', ...data }) },
    session: {
      deleteMany: async (args: any) => {
        changes.push({ model: 'session', args });
        return { count: 1 };
      },
    },
    nutritionistProfile: { findUnique: async () => ({ id: 'professional' }) },
    clinicalProfileReview: release('profileReview'),
    clinicalDocument: release('document'),
    mealPlan: release('plan'),
    mealBaseVerification: release('baseVerification'),
    outsideMealReview: release('outsideReview'),
    auditEvent: {
      create: async (args: any) => {
        changes.push({ model: 'audit', args });
        return {};
      },
    },
  };
  prisma.user.findUnique = (async () => ({ id: 'account', role: 'NUTRITIONIST' })) as any;
  prisma.$transaction = (async (work: any) => work(tx)) as any;
  prisma.mealConditionClearance.findMany = (async () => []) as any;
  prisma.conditionRulePolicyVersion.findMany = (async () => []) as any;
  try {
    const revoked = await AdminService.setUserSuspension('admin', 'account', true, 'Access revoked by admin');
    assert.equal(revoked.isSuspended, true);
    assert.equal(changes[0].model, 'session');
    assert.equal(changes.filter((change) => change.model !== 'audit').length, 6);
    for (const change of changes.filter((change) => !['audit', 'session'].includes(change.model))) {
      assert.equal(change.args.where.claimedByNutritionistId, 'professional');
      assert.equal(change.args.data.claimedByNutritionistId, null);
      assert.equal(change.args.data.claimedAt, null);
      assert.equal(change.args.data.reviewerId, undefined);
      assert.equal(change.args.data.reviewedAt, undefined);
    }
    const outside = changes.find((change) => change.model === 'outsideReview')!;
    assert.equal(outside.args.where.status, 'CLAIMED');
    assert.equal(outside.args.data.status, 'PENDING');
    assert.equal(outside.args.data.claimedRevision, null);
    assert.equal(changes.at(-1)!.args.data.action, 'USER_SUSPENDED');
    changes.length = 0;
    const restored = await AdminService.setUserSuspension('admin', 'account', false);
    assert.equal(restored.isSuspended, false);
    assert.equal(restored.suspensionReason, null);
    assert.deepEqual(
      changes.map((change) => change.model),
      ['audit']
    );
    assert.equal(changes[0].args.data.action, 'USER_REINSTATED');
  } finally {
    prisma.$transaction = original.transaction;
    prisma.user.findUnique = original.user;
    prisma.mealConditionClearance.findMany = original.clearances;
    prisma.conditionRulePolicyVersion.findMany = original.policies;
    await prisma.$disconnect();
  }
});

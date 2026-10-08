import { ReviewRoutingService } from '../src/services/review-routing.service';
import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/lib/prisma';
import { ClinicalProfileReviewService as Reviews } from '../src/services/clinical-profile-review.service';
import { ClinicalEvidenceService } from '../src/services/clinical-evidence.service';

test('profile claims serialize reviewers and reject expired, unclaimed, revoked and stale decisions', async (t) => {
  // These claim/evidence fixtures exercise the existing path with routing disabled.
  // The new routing HTTP acceptance tests cover enabled authorization separately.
  t.mock.method(ReviewRoutingService, 'config', async () => ({ id: 'global', enabled: false, enabledAt: null }));
  const original = {
    transaction: prisma.$transaction,
    user: prisma.user.findUnique,
    reviewer: prisma.nutritionistProfile.findUnique,
    notify: prisma.notification.create,
    report: prisma.nutritionReport.findUnique,
    detail: Reviews.detail,
    ready: ClinicalEvidenceService.assertReadyForMealPlanning,
  };
  const user = {
    id: 'patient',
    role: 'USER',
    userProfile: { revision: 4, safetyRevision: 1 },
    healthConditions: [{ condition: 'DIABETES' }],
    allergies: [],
    clinicalContextResponses: [],
    safetyProfileEntries: [
      { domain: 'CONDITION', canonicalCode: 'DIABETES', supportState: 'SUPPORTED' },
      { domain: 'ALLERGY', canonicalCode: 'NONE', supportState: 'SUPPORTED' },
    ],
  };
  const reviewers = new Map(
    ['a', 'b'].map((id) => [
      id,
      {
        id,
        userId: `account-${id}`,
        isVerified: true,
        prcLicenseExpiry: new Date('2030-01-01'),
        user: { role: 'NUTRITIONIST', isSuspended: false },
      },
    ])
  );
  let row: any = null;
  const queryReviewer = async ({ where }: any) => reviewers.get(where.id);
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async () => [],
    user: { findUnique: async () => user, findUniqueOrThrow: async () => user },
    nutritionistProfile: { findUnique: queryReviewer },
    auditEvent: { create: async () => ({}) },
    clinicalProfileReview: {
      findUnique: async ({ where }: any) =>
        !row ||
        (where.userId_profileRevision_policyVersion &&
          where.userId_profileRevision_policyVersion.policyVersion !== row.policyVersion)
          ? null
          : { ...row },
      upsert: async ({ create, update }: any) => {
        row = row ? { ...row, ...update } : { status: 'PENDING', ...create };
        return row;
      },
      update: async ({ data }: any) => {
        Object.assign(row, data);
        return row;
      },
      updateMany: async ({ data }: any) => {
        Object.assign(row, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => row,
    },
  };
  let queue = Promise.resolve();
  prisma.$transaction = (async (work: any) => {
    const result = queue.then(() => work(tx));
    queue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }) as typeof original.transaction;
  prisma.user.findUnique = (async () => user) as any;
  prisma.nutritionistProfile.findUnique = queryReviewer as any;
  prisma.notification.create = (async () => ({})) as any;
  prisma.nutritionReport.findUnique = (async () => null) as any;
  Reviews.detail = (async () => ({})) as any;
  ClinicalEvidenceService.assertReadyForMealPlanning = async () => [];
  const scopeKey = JSON.stringify([1, ['DIABETES'], [], [], [], []]);
  const expected = { profileRevision: 4, scopeKey };
  try {
    const claims = await Promise.allSettled([Reviews.claim('a', 'patient'), Reviews.claim('b', 'patient')]);
    assert.equal(claims.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(row.claimedByNutritionistId, 'a');
    await assert.rejects(
      () => Reviews.decide('b', 'patient', 'APPROVED', 'Reviewed health details.', undefined, expected),
      /Claim this profile/
    );
    await assert.rejects(
      () =>
        Reviews.decide('a', 'patient', 'APPROVED', 'Reviewed health details.', undefined, {
          ...expected,
          profileRevision: 3,
        }),
      /profile changed/
    );
    row.claimedAt = new Date(Date.now() - 31 * 60_000);
    await assert.rejects(
      () => Reviews.decide('a', 'patient', 'APPROVED', 'Reviewed health details.', undefined, expected),
      /Claim this profile/
    );
    await Reviews.claim('b', 'patient');
    reviewers.get('b')!.user.isSuspended = true;
    await assert.rejects(
      () => Reviews.decide('b', 'patient', 'APPROVED', 'Reviewed health details.', undefined, expected),
      /verified nutritionist/
    );
    reviewers.get('b')!.user.isSuspended = false;
    const result = await Reviews.decide('b', 'patient', 'APPROVED', 'Reviewed health details.', undefined, expected);
    assert.equal(result.status, 'APPROVED');
    assert.equal(row.claimedByNutritionistId, null);
    assert.equal(row.reviewerId, 'b');
  } finally {
    prisma.$transaction = original.transaction;
    prisma.user.findUnique = original.user;
    prisma.nutritionistProfile.findUnique = original.reviewer;
    prisma.notification.create = original.notify;
    prisma.nutritionReport.findUnique = original.report;
    Reviews.detail = original.detail;
    ClinicalEvidenceService.assertReadyForMealPlanning = original.ready;
    await prisma.$disconnect();
  }
});

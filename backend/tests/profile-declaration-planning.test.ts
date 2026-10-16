import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { CONDITION_SAFETY_CATALOGUE, FOOD_SAFETY_CATALOGUE, resolveSafetyEntries } from '../src/domain/safety-intake.policy';
import { needsProfileDeclarationReview } from '../src/domain/profile-declaration-review.policy';
import { adaptUserSafetyRestrictions } from '../src/domain/structured-restriction.adapter';
import { context } from '../src/services/clinical-profile-review.context';
import { ClinicalProfileReviewService as Reviews } from '../src/services/clinical-profile-review.service';

test('every recognized catalogue choice can proceed without routine intake review', () => {
  for (const item of [...CONDITION_SAFETY_CATALOGUE, ...FOOD_SAFETY_CATALOGUE]) {
    for (const domain of item.domains) {
      const entries = resolveSafetyEntries([{ domain, value: item.code, provenance: 'PREDEFINED' }]);
      assert.equal(needsProfileDeclarationReview({ safetyEntries: entries }), false, `${domain}:${item.code}`);
    }
  }
  const alias = resolveSafetyEntries([{ domain: 'CONDITION', value: 'high blood pressure', provenance: 'CUSTOM' }]);
  assert.equal(needsProfileDeclarationReview({ safetyEntries: alias }), false);
  const restrictions = adaptUserSafetyRestrictions({ safetyEntries: alias });
  assert.deepEqual(restrictions.conditions, ['HYPERTENSION']);
});

test('recognition does not make medical conditions unrestricted, and unknown mixed declarations still need review', () => {
  const known = resolveSafetyEntries([{ domain: 'CONDITION', value: 'KIDNEY_DISEASE', provenance: 'PREDEFINED' }]);
  assert.equal(needsProfileDeclarationReview({ safetyEntries: known }), false);
  const restrictions = adaptUserSafetyRestrictions({ safetyEntries: known });
  assert.deepEqual(restrictions.conditions, ['KIDNEY_DISEASE']);
  assert.equal(restrictions.requiresReview, true);
  for (const text of ['my unknown condition', 'sick']) {
    const mixed = [...known, ...resolveSafetyEntries([{ domain: 'CONDITION', value: text, provenance: 'CUSTOM' }])];
    assert.equal(needsProfileDeclarationReview({ safetyEntries: mixed }), true);
  }
  assert.equal(needsProfileDeclarationReview({ otherConditions: 'unknown' }), true);
  assert.equal(needsProfileDeclarationReview({ safetyEntries: [{ domain: 'CONDITION', canonicalCode: 'UNMAPPED', supportState: 'SUPPORTED' }] }), true);
});

test('planning gate, status and automatic queue agree for recognized intake and preserve explicit current holds', async (t) => {
  const user: any = {
    id: 'member', role: 'USER', name: 'Synthetic member', onboardingDone: true,
    userProfile: { revision: 1, safetyRevision: 1 },
    healthConditions: [{ condition: 'DIABETES' }], allergies: [], clinicalContextResponses: [], clinicalDocuments: [],
    safetyProfileEntries: resolveSafetyEntries([
      { domain: 'CONDITION', value: 'DIABETES', provenance: 'PREDEFINED' },
      { domain: 'ALLERGY', value: 'NONE', provenance: 'PREDEFINED' },
    ]),
  };
  let reviews: any[] = [];
  const original = { first: prisma.user.findFirst, unique: prisma.user.findUnique, many: prisma.user.findMany,
    reviews: prisma.clinicalProfileReview.findMany, latest: prisma.clinicalProfileReview.findFirst };
  t.after(() => {
    prisma.user.findFirst = original.first; prisma.user.findUnique = original.unique; prisma.user.findMany = original.many;
    prisma.clinicalProfileReview.findMany = original.reviews; prisma.clinicalProfileReview.findFirst = original.latest;
  });
  prisma.user.findFirst = (async () => user) as any;
  prisma.user.findUnique = (async () => user) as any;
  prisma.user.findMany = (async () => [user]) as any;
  prisma.clinicalProfileReview.findMany = (async () => reviews) as any;
  prisma.clinicalProfileReview.findFirst = (async () => reviews[0] ?? null) as any;
  const client = prisma as unknown as Pick<Prisma.TransactionClient, 'user' | 'clinicalProfileReview'>;
  assert.equal(await Reviews.hasCurrentApproval(user.id, client), true);
  assert.equal((await Reviews.status(user.id)).required, false);
  assert.equal((await Reviews.currentApprovalsByUser([user.id])).get(user.id), true);
  assert.deepEqual(await Reviews.queue(), []);
  assert.equal(await prisma.clinicalProfileReview.findMany().then(rows => rows.length), 0, 'No fabricated approval');

  reviews = [{ userId: user.id, status: 'DECLINED', profileSnapshot: context(user).snapshot, reasonCodes: ['DETAILS_REQUESTED'] }];
  assert.equal(await Reviews.hasCurrentApproval(user.id, client), false);
  assert.equal((await Reviews.status(user.id)).required, true);
  assert.equal((await Reviews.currentApprovalsByUser([user.id])).get(user.id), false);
  assert.equal((await Reviews.queue()).length, 1);

  user.safetyProfileEntries[0] = resolveSafetyEntries([{ domain: 'CONDITION', value: 'an unknown named condition', provenance: 'CUSTOM' }])[0];
  reviews = [];
  assert.equal(await Reviews.hasCurrentApproval(user.id, client), false);
  assert.equal((await Reviews.status(user.id)).required, true);
  assert.equal((await Reviews.queue()).length, 1);
  reviews = [{ userId: user.id, status: 'APPROVED', profileSnapshot: context(user).snapshot }];
  assert.equal(await Reviews.hasCurrentApproval(user.id, client), true, 'Actual matching clarification approval remains valid');
});

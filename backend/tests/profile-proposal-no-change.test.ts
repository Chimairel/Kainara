import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';

test('profile corrections reject unchanged declarations despite section or entry order', async (t) => {
  process.env.CLINICAL_CLARIFICATIONS_ENABLED = 'true';
  const { ClinicalProfileProposalService: Proposals } =
    await import('../src/services/clinical-profile-proposal.service');
  const { context } = await import('../src/services/clinical-profile-review.context');
  const { ReviewRoutingService } = await import('../src/services/review-routing.service');
  const { default: prisma } = await import('../src/lib/prisma');
  const entries = [
    {
      domain: 'CONDITION',
      canonicalCode: 'DIABETES',
      originalText: 'DIABETES',
      provenance: 'PREDEFINED',
      supportState: 'SUPPORTED',
    },
    {
      domain: 'CONDITION',
      canonicalCode: 'HYPERTENSION',
      originalText: 'HYPERTENSION',
      provenance: 'PREDEFINED',
      supportState: 'SUPPORTED',
    },
    {
      domain: 'ALLERGY',
      canonicalCode: 'NONE',
      originalText: 'NONE',
      provenance: 'PREDEFINED',
      supportState: 'SUPPORTED',
    },
  ];
  const user = {
    id: 'member',
    role: 'USER',
    userProfile: { revision: 4, safetyRevision: 1 },
    healthConditions: [{ condition: 'DIABETES' }, { condition: 'HYPERTENSION' }],
    allergies: [],
    safetyProfileEntries: entries,
    clinicalContextResponses: [],
    clinicalDocuments: [],
  };
  const scopeKey = context(user as any).scopeKey;
  const expected = { profileRevision: 4, scopeKey };
  let writes = 0;
  const tx = {
    $executeRaw: async () => 1,
    $queryRaw: async () => [],
    user: { findUnique: async () => user },
    nutritionistProfile: {
      findUnique: async () => ({
        id: 'reviewer',
        userId: 'rnd-account',
        isVerified: true,
        prcLicenseExpiry: new Date('2099-01-01'),
        user: { role: 'NUTRITIONIST', isSuspended: false },
      }),
    },
    clinicalProfileReview: {
      findUnique: async () => ({
        status: 'PENDING',
        claimedByNutritionistId: 'reviewer',
        claimedAt: new Date(),
      }),
    },
    clinicalClarificationForm: { count: async () => 0 },
    clinicalProfileProposal: {
      findUnique: async () => null,
      findFirst: async () => null,
      updateMany: async () => ({ count: 0 }),
      create: async () => {
        writes++;
        return { id: 'proposal' };
      },
    },
    safetyProfileEntry: { findMany: async () => entries },
    clinicalContextResponse: { findMany: async () => [] },
    auditEvent: { create: async () => ({}) },
    notification: { create: async () => ({}) },
  };
  t.mock.method(ReviewRoutingService, 'assertProfile', async () => undefined);
  t.mock.method(prisma, '$transaction', async (work: (client: any) => Promise<unknown>) => work(tx));
  const input = (values: string[]) => ({
    ...expected,
    requestKey: randomUUID(),
    rationale: 'Reviewed the recorded declarations.',
    changes: {
      domains: [
        {
          domain: 'CONDITION' as const,
          entries: values.map((value) => ({ value, provenance: 'PREDEFINED' as const })),
        },
      ],
      healthDetails: [],
    },
    evidence: [],
  });
  for (const values of [
    ['DIABETES', 'HYPERTENSION'],
    ['HYPERTENSION', 'DIABETES'],
  ]) {
    await assert.rejects(
      () => Proposals.publish('reviewer', 'member', input(values)),
      (error: any) => error.errorCode === 'PROFILE_PROPOSAL_NO_CHANGE'
    );
  }
  assert.equal(writes, 0, 'Reordering unchanged values must not send a correction to the member.');
  assert.deepEqual(await Proposals.publish('reviewer', 'member', input(['DIABETES'])), { id: 'proposal' });
  assert.equal(writes, 1, 'A real removed declaration still creates a correction for acknowledgment.');
});

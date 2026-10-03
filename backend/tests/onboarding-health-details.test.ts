import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicalEvidenceArea, HealthConditionType, Prisma } from '@prisma/client';
import {
  captureOnboardingConditionDetails,
  retainOnboardingConditionDetails,
} from '../src/services/onboarding-health-details.service';
import { healthDetailsRequirements } from '../src/domain/health-details.policy';

const responses = {
  conditionDetails: 'User-reported diabetes details',
  medications: 'None',
  dietaryAdvice: 'Unknown',
  recentSymptoms: 'None',
  measurements: '',
  formVersion: 'HEALTH_DETAILS_V1',
  safetyRevision: 2,
};
const expected = { conditions: ['DIABETES'], otherConditions: '' };
function fixture(onboardingDone = false, stale = false) {
  const user = {
    onboardingDone,
    userProfile: { safetyRevision: 2, otherConditions: '', otherAllergies: '' },
    healthConditions: [{ condition: HealthConditionType.DIABETES }],
  };
  const contexts = [
    {
      id: 'condition',
      area: ClinicalEvidenceArea.DIABETES,
      responses: { ...responses, safetyRevision: stale ? 1 : 2 },
    },
    { id: 'allergy', area: ClinicalEvidenceArea.FOOD_ALLERGY, responses },
  ];
  const updates: unknown[] = [];
  const audits: unknown[] = [];
  let reads = 0;
  const tx = {
    user: {
      findUnique: async () => {
        reads++;
        return user;
      },
    },
    clinicalContextResponse: {
      findMany: async ({ where }: { where: { area: { in: ClinicalEvidenceArea[] } } }) =>
        contexts.filter((item) => where.area.in.includes(item.area)),
      update: async (input: unknown) => {
        updates.push(input);
        return input;
      },
    },
    auditEvent: {
      create: async (input: unknown) => {
        audits.push(input);
        return input;
      },
    },
  } as unknown as Prisma.TransactionClient;
  return { tx, updates, audits, user, getReads: () => reads };
}

test('initial onboarding retains current condition statements across the allergy revision, without completing allergy details', async () => {
  const f = fixture();
  const snapshot = await captureOnboardingConditionDetails(f.tx, 'fixture', true, expected);
  assert.equal(snapshot?.contexts.length, 1);
  await retainOnboardingConditionDetails(f.tx, 'fixture', snapshot, 3);
  assert.deepEqual(f.updates, [
    {
      where: { id: 'condition' },
      data: { responses: { ...responses, safetyRevision: 3 }, revision: { increment: 1 } },
    },
  ]);
  assert.equal(f.audits.length, 1);
  const requirements = healthDetailsRequirements({
    ...f.user,
    userProfile: { ...f.user.userProfile, safetyRevision: 3 },
    allergies: [{ allergen: 'NUTS' }],
    clinicalContextResponses: [{ area: ClinicalEvidenceArea.DIABETES, responses: { ...responses, safetyRevision: 3 } }],
  });
  assert.deepEqual(
    requirements.map((item) => item.state),
    ['READY', 'CONTEXT_REQUIRED']
  );
  assert.ok(requirements.every((item) => item.readyDocumentIds.length === 0));
});

test('completed members keep the existing full safety-revision invalidation', async () => {
  const f = fixture(true);
  assert.equal(await captureOnboardingConditionDetails(f.tx, 'fixture', true, expected), null);
  assert.equal(f.updates.length, 0);
});

test('changed condition declarations cannot carry their prior answers', async () => {
  const f = fixture();
  assert.equal(await captureOnboardingConditionDetails(f.tx, 'fixture', false, expected), null);
  assert.equal(f.getReads(), 0);
  assert.equal(
    await captureOnboardingConditionDetails(f.tx, 'fixture', true, {
      conditions: ['HYPERTENSION'],
      otherConditions: '',
    }),
    null
  );
  assert.equal(
    await captureOnboardingConditionDetails(f.tx, 'fixture', true, {
      ...expected,
      otherConditions: 'New custom condition',
    }),
    null
  );
});

test('stale condition forms and nonconsecutive revisions are never made current', async () => {
  const f = fixture(false, true);
  const stale = await captureOnboardingConditionDetails(f.tx, 'fixture', true, expected);
  assert.deepEqual(stale?.contexts, []);
  await retainOnboardingConditionDetails(f.tx, 'fixture', stale, 3);
  const fresh = fixture();
  const snapshot = await captureOnboardingConditionDetails(fresh.tx, 'fixture', true, expected);
  await retainOnboardingConditionDetails(fresh.tx, 'fixture', snapshot, 4);
  assert.deepEqual(f.updates, []);
  assert.deepEqual(fresh.updates, []);
});

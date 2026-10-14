import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicalEvidenceArea, HealthConditionType } from '@prisma/client';
import { healthDetailsRequirements, healthDetailsAreas } from '../src/domain/health-details.policy';
import { healthDetailsSchema } from '../src/validation/health-details.schemas';

const answers = {
  conditionDetails: 'Kidney disease; stage unknown',
  medications: 'Unknown',
  dietaryAdvice: 'None',
  recentSymptoms: 'None',
  measurements: '',
};
const user = {
  userProfile: { safetyRevision: 2, otherConditions: null, otherAllergies: null },
  healthConditions: [{ condition: HealthConditionType.KIDNEY_DISEASE }],
  allergies: [{ allergen: 'PEANUTS' }],
  clinicalContextResponses: [] as Array<{ area: ClinicalEvidenceArea; responses: unknown }>,
};

test('condition details do not turn a known food preference into an allergy-details requirement', () => {
  const profile = {
    ...user,
    healthConditions: [{ condition: HealthConditionType.HEART_CONDITION }],
    allergies: [],
    userProfile: { ...user.userProfile, otherAllergies: 'PORK' },
    safetyProfileEntries: [
      { domain: 'CONDITION', canonicalCode: 'HEART_CONDITION', supportState: 'RECOGNIZED_UNSUPPORTED' },
      { domain: 'AVOIDED_INGREDIENT', canonicalCode: 'PORK', supportState: 'RECOGNIZED_UNSUPPORTED' },
    ],
  };
  assert.deepEqual(
    healthDetailsAreas(profile),
    ['HEART_CONDITION']
  );
  assert.deepEqual(
    healthDetailsAreas({
      ...profile,
      safetyProfileEntries: [
        ...profile.safetyProfileEntries,
        { domain: 'ALLERGY', canonicalCode: null, displayName: 'Pork', supportState: 'PENDING_REVIEW' },
      ],
    }),
    ['HEART_CONDITION', 'FOOD_ALLERGY']
  );
});
test('declarations do not fabricate forms; recorded forms must remain complete and current', () => {
  const missing = healthDetailsRequirements(user);
  assert.deepEqual(missing, []);
  const responses = { ...answers, formVersion: 'HEALTH_DETAILS_V1', safetyRevision: 2 };
  const complete = healthDetailsRequirements({
    ...user,
    clinicalContextResponses: healthDetailsAreas(user).map(area => ({ area, responses })),
  });
  assert.ok(complete.every((item) => item.state === 'READY'));
  assert.ok(
    complete.every((item) => item.readyDocumentIds.length === 0),
    'User statements do not become verified documents.'
  );
});
test('details from an earlier safety revision do not satisfy the current profile', () => {
  const result = healthDetailsRequirements({
    ...user,
    clinicalContextResponses: [
      {
        area: ClinicalEvidenceArea.KIDNEY_DISEASE,
        responses: { ...answers, formVersion: 'HEALTH_DETAILS_V1', safetyRevision: 1 },
      },
    ],
  });
  assert.ok(result.every((item) => item.state !== 'READY'));
});
test('health details reject omitted medication context and client-supplied verification', () => {
  const body = { ...answers, area: 'KIDNEY_DISEASE', expectedSafetyRevision: 2 };
  assert.equal(healthDetailsSchema.safeParse(body).success, true);
  assert.equal(healthDetailsSchema.safeParse({ ...body, medications: '' }).success, false);
  assert.equal(healthDetailsSchema.safeParse({ ...body, verified: true }).success, false);
});

test('allergy declarations expose relevant areas without creating answers or an automatic form requirement', () => {
  const allergyOnly = { ...user, healthConditions: [], allergies: [{ allergen: 'SHELLFISH' }] };
  for (const source of [allergyOnly, { ...allergyOnly, allergies: [{ allergen: 'SOY' }] },
    { ...allergyOnly, userProfile: { ...user.userProfile, otherAllergies: 'sesame' } }]) {
    assert.deepEqual(healthDetailsRequirements(source), []);
    assert.deepEqual(healthDetailsAreas(source), ['FOOD_ALLERGY']);
  }
});

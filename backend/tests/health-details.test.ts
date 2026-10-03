import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicalEvidenceArea, HealthConditionType } from '@prisma/client';
import { healthDetailsRequirements } from '../src/domain/health-details.policy';
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
test('declared conditions and allergies need their own complete current form', () => {
  const missing = healthDetailsRequirements(user);
  assert.deepEqual(
    missing.map((item) => item.state),
    ['CONTEXT_REQUIRED', 'CONTEXT_REQUIRED']
  );
  const responses = { ...answers, formVersion: 'HEALTH_DETAILS_V1', safetyRevision: 2 };
  const complete = healthDetailsRequirements({
    ...user,
    clinicalContextResponses: missing.map(({ area }) => ({ area, responses })),
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

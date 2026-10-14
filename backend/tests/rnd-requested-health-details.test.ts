import assert from 'node:assert/strict';
import test from 'node:test';
import { ClinicalEvidenceArea, HealthConditionType } from '@prisma/client';
import { healthDetailsRequirements, isRequestedHealthDetails } from '../src/domain/health-details.policy';
import { evaluateOnboardingStatus, CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';

const user = { userProfile: { safetyRevision: 2, otherConditions: '', otherAllergies: '' },
  healthConditions: [{ condition: HealthConditionType.DIABETES }], allergies: [{ allergen: 'NUTS' }],
  clinicalContextResponses: [] as Array<{ area: ClinicalEvidenceArea; responses: unknown }> };
test('condition and allergy declarations create no health-detail form or placeholder answers', () => {
  assert.deepEqual(healthDetailsRequirements(user), []);
  assert.equal(user.clinicalContextResponses.length, 0);
});
test('saved historical detail responses keep their safety revision boundary', () => {
  const saved = { conditionDetails: 'Historical member answer', medications: 'None', dietaryAdvice: 'Unknown',
    recentSymptoms: 'None', measurements: '', formVersion: 'HEALTH_DETAILS_V1', safetyRevision: 2 };
  const source = { ...user, clinicalContextResponses: [{ area: ClinicalEvidenceArea.DIABETES, responses: saved }] };
  assert.equal(healthDetailsRequirements(source)[0].state, 'READY');
  assert.equal(healthDetailsRequirements({ ...source, userProfile: { ...user.userProfile, safetyRevision: 3 } })[0].state, 'CONTEXT_REQUIRED');
});
test('onboarding proceeds from a condition declaration directly to food safety, then consent', () => {
  const snapshot = { onboardingDone: false, tosAccepted: true, acceptedTermsVersion: CURRENT_TERMS_VERSION,
    acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION, conditions: ['DIABETES'], allergies: ['NUTS'],
    profile: { age: 25, biologicalSex: 'FEMALE', heightCm: 160, weightKg: 60, targetWeightKg: 60, goal: 'MAINTAIN',
      activityLevel: 'ACTIVE', dietaryPreference: 'OMNIVORE', ricePreference: 'FLEXIBLE', foodCulture: 'Filipino', shoppingDayOfWeek: 6 },
    safetyEntries: [{ domain: 'CONDITION' }], healthDetails: [{ area: 'DIABETES', state: 'CONTEXT_REQUIRED' }] };
  assert.equal(evaluateOnboardingStatus(snapshot).nextPath, '/onboarding/allergies');
  assert.equal(evaluateOnboardingStatus({ ...snapshot, safetyEntries: [{ domain: 'CONDITION' }, { domain: 'ALLERGY' }] }).readyToComplete, true);
});

test('first health detail creation requires an RND request for this area and current scope', () => {
  const input = { status: 'DECLINED', reasonCodes: ['DETAILS_REQUESTED', 'DIABETES'], savedScopeKey: 'current', currentScopeKey: 'current', area: 'DIABETES' };
  assert.equal(isRequestedHealthDetails(input), true);
  for (const patch of [{ status: 'APPROVED' }, { reasonCodes: [] }, { area: 'FOOD_ALLERGY' }, { savedScopeKey: 'previous' }, { savedScopeKey: null }])
    assert.equal(isRequestedHealthDetails({ ...input, ...patch }), false);
});

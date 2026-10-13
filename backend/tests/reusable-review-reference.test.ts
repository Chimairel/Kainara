import assert from 'node:assert/strict';
import test from 'node:test';
import { reusableClinicalContextKey, referencePlateFacts } from '../src/domain/reusable-review-reference.policy';

const fixture = {
  policyVersion: 'MEAL_REVIEW_CONTEXT_V1',
  userId: 'private-member-A',
  profile: {
    age: 28,
    biologicalSex: 'MALE',
    heightCm: 170,
    weightKg: 65,
    dailyCalorieTarget: 2000,
    goal: 'MAINTAIN',
    revision: 1,
  },
  clinical: {
    conditions: ['TYPE_2_DIABETES'],
    allergies: [],
    healthDetails: [{ area: 'DIABETES', revision: 1, responses: { medication: 'private exact medication' } }],
  },
  safetyEntries: [
    {
      id: 'entry-A',
      userId: 'member-A',
      domain: 'CONDITION',
      canonicalCode: 'DIABETES',
      normalizedText: 'type 2 diabetes',
      supportState: 'SUPPORTED',
    },
  ],
  clinicalDocuments: [
    {
      sha256: 'a'.repeat(64),
      id: 'doc-A',
      issuerName: 'Recorded issuer',
      validUntil: '2027-01-01',
      facts: [{ id: 'fact-A', code: 'TEST', valueNumber: 10, unit: 'unit', reviewStatus: 'CONFIRMED' }],
    },
  ],
  guidance: { selected: { policyVersion: 'policy' } },
  meal: { calories: 800, proteinG: 0, carbsG: 80, fatG: 20, nutritionistNote: 'PRIVATE_NOTE' },
};
const key = (value: unknown, forms: unknown[] = []) =>
  reusableClinicalContextKey(value, forms, 'synthetic-signing-secret');
test('exact reference keys ignore identities and revision metadata, never a clinical data approximation', () => {
  const same = structuredClone(fixture);
  same.userId = 'private-member-B';
  same.profile.revision = 8;
  same.safetyEntries[0].id = 'entry-B';
  same.safetyEntries[0].userId = 'member-B';
  same.clinical.healthDetails[0].revision = 5;
  same.clinicalDocuments[0].id = 'doc-B';
  same.clinicalDocuments[0].facts[0].id = 'fact-B';
  assert.equal(key(same), key(fixture));
  for (const patch of [{ age: 29 }, { weightKg: 64 }, { goal: 'LOSE_WEIGHT' }, { biologicalSex: 'FEMALE' }])
    assert.notEqual(key({ ...fixture, profile: { ...fixture.profile, ...patch } }), key(fixture));
  const medication = structuredClone(fixture);
  medication.clinical.healthDetails[0].responses.medication = 'different medication';
  assert.notEqual(key(medication), key(fixture));
  const document = structuredClone(fixture);
  document.clinicalDocuments[0].facts[0].valueNumber = 11;
  assert.notEqual(key(document), key(fixture));
  const changedContent = structuredClone(fixture);
  changedContent.clinicalDocuments[0].sha256 = 'b'.repeat(64);
  assert.notEqual(key(changedContent), key(fixture));
  assert.notEqual(key(fixture, [{ question: 'Clarify', answer: 'yes' }]), key(fixture));
  assert.notEqual(
    key(fixture, [{ question: 'Clarify', answer: 'yes' }]),
    key(fixture, [{ question: 'Clarify', answer: 'no' }])
  );
});
test('every planning field and clinical answer remains part of the exact match', () => {
  const fields = [
    'age',
    'biologicalSex',
    'heightCm',
    'weightKg',
    'targetWeightKg',
    'goal',
    'activityLevel',
    'dietaryPreference',
    'ricePreference',
    'foodCulture',
    'dailyCalorieTarget',
    'otherConditions',
    'otherAllergies',
    'shoppingDayGroup',
    'shoppingDayOfWeek',
    'planningGeographyLevel',
    'planningRegionName',
    'planningProvinceHucName',
  ];
  for (const field of fields) {
    assert.notEqual(key({ ...fixture, profile: { ...fixture.profile, [field]: 'changed' } }), key(fixture), field);
  }
  for (const field of ['medications', 'dietaryAdvice', 'recentSymptoms', 'measurements']) {
    const changed = structuredClone(fixture);
    Object.assign(changed.clinical.healthDetails[0].responses, { [field]: 'changed' });
    assert.notEqual(key(changed), key(fixture), field);
  }
});
test('missing historical inputs are unavailable and reusable payload contains numeric facts only', () => {
  assert.equal(key({}), null);
  assert.equal(key({ ...fixture, clinical: {} }), null);
  assert.deepEqual(referencePlateFacts(fixture), { calories: 800, proteinG: 0, carbsG: 80, fatG: 20 });
  for (const calories of [null, NaN, Infinity, -1])
    assert.equal(referencePlateFacts({ meal: { ...fixture.meal, calories } }), null);
  const serialized = JSON.stringify({ key: key(fixture), facts: referencePlateFacts(fixture) });
  for (const text of ['private-member', 'medication', 'issuer', 'PRIVATE_NOTE', 'doc-A'])
    assert(!serialized.includes(text));
});

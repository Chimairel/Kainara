import assert from 'node:assert/strict';
import test from 'node:test';
import { effectiveRecipeMealTypes } from '../src/domain/meal-applicability.policy';
import { MealType } from '@prisma/client';
import { foodChoicePreference } from '../src/domain/food-choice-rules.policy';
import { reportProfileSummary } from '../src/domain/report-profile-summary.policy';
import { screenPlanningRules, effectivePatientLimits, type PatientLimitLike, type PlanningNutrientRule } from '../src/domain/planning-rule-screening.policy';
import { planningDayTotals } from '../src/services/planning-rule-screening.service';
import { patientNutritionLimitSchema } from '../src/validation/patient-nutrition-limit.schemas';
import { clinicalRuleKey, clinicalRuleSnapshot } from '../src/domain/clinical-rule-stamp.policy';

test('plain components, taho, desserts and drinks cannot occupy primary slots; composite dishes remain distinct', () => {
  for (const name of ['Homemade Taho', 'Pandesal', 'Traditional Filipino Pandesal', 'Pan de sal recipe', 'Garlic Bread', 'Banana Smoothie', 'Leche Flan', 'Filipino vinegar dipping sauce'])
    assert(!effectiveRecipeMealTypes(name, null, [MealType.BREAKFAST, MealType.LUNCH, MealType.DINNER]).some(type => type !== MealType.SNACK), name);
  for (const name of ['Pandesal egg sandwich', 'Vegetable Omelet', 'Breaded Chicken', 'Fish Cakes', 'Chicken Adobo'])
    assert(effectiveRecipeMealTypes(name, null, [MealType.BREAKFAST]).includes(MealType.BREAKFAST), name);
});

test('educational limit/choose preferences rank actual ingredients without banning all carbohydrates', () => {
  assert(foodChoicePreference(['DIABETES'], ['brown sugar', 'silken tofu']).penalty > 0);
  assert(foodChoicePreference(['DIABETES'], ['brown rice']).penalty < 0);
  assert.equal(foodChoicePreference([], ['brown sugar']).warnings.length, 0);
  assert.equal(foodChoicePreference(['KIDNEY_DISEASE'], ['mung beans']).preferred.length, 0);
});

const now = new Date('2026-10-17T00:00:00Z');
const defaultRule: PlanningNutrientRule = { id: 'sodium-default', condition: 'HYPERTENSION', nutrient: 'SODIUM_MG', operator: 'LESS_THAN_OR_EQUAL',
  threshold: 2000, unit: 'mg', basis: 'DAILY_TOTAL', severity: 'HARD_BLOCK', active: true, reviewStatus: 'APPROVED', approvedByNutritionistId: 'reviewer' };
const override: PatientLimitLike = { ...defaultRule, id: 'patient-limit', userId: 'member', replacesRuleId: defaultRule.id, threshold: 1500,
  version: 1, validFrom: new Date('2026-10-16T00:00:00Z'), validUntil: null, revokedAt: null };
const screen = (changes: Partial<Parameters<typeof screenPlanningRules>[0]> = {}) => screenPlanningRules({
  rules: [defaultRule], overrides: [], userId: 'member', now, conditions: ['HYPERTENSION'], ingredientRules: [], ingredientNames: [],
  nutrients: { calories: 600, sodiumMg: 500 }, dailyTotals: { calories: 1800, sodiumMg: 1800 }, ...changes,
});

test('patient limits replace only the named default; unrelated restrictions and other conditions remain', () => {
  const extra = { ...defaultRule, id: 'other-rule', nutrient: 'CARBOHYDRATE_G', threshold: 200, condition: 'DIABETES' };
  const result = screen({ rules: [defaultRule, extra], overrides: [override], conditions: ['HYPERTENSION', 'DIABETES'], dailyTotals: { sodiumMg: 1800, carbsG: 250 } });
  assert.equal(result.blocked, true);
  assert.deepEqual(result.evaluations.map(row => row.rule.id), ['other-rule', 'patient-limit']);
  assert.equal(screen({ overrides: [{ ...override, userId: 'another-member' }] }).blocked, false);
});

test('missing nutrients and incomplete daily totals require review; no daily threshold is applied separately to each meal', () => {
  assert.equal(screen().blocked, false);
  assert.equal(screen({ dailyTotals: undefined }).requiresReview, true);
  assert.equal(screen({ dailyTotals: { calories: 1800, sodiumMg: null } }).requiresReview, true);
  assert.equal(screen({ dailyTotals: { calories: 1800, sodiumMg: 2500 } }).blocked, true);
  assert.equal(planningDayTotals([{ mealType: 'BREAKFAST', nutrients: { calories: 600 } }]), undefined);
  const rows = ['BREAKFAST', 'LUNCH', 'DINNER'].map(mealType => ({ mealType, nutrients: { calories: 600, sodiumMg: 600 } }));
  assert.equal(planningDayTotals(rows)?.sodiumMg, 1800);
  assert.equal(planningDayTotals([...rows, rows[0]]), undefined);
  assert.equal(planningDayTotals(rows.map((row, i) => i ? row : { ...row, nutrients: { calories: 600 } }))?.sodiumMg, null);
});

test('future, expired or revoked patient versions cannot resurrect superseded limits', () => {
  assert.equal(effectivePatientLimits([{ ...override, validFrom: new Date('2026-11-01') }], 'member', now).length, 0);
  assert.equal(effectivePatientLimits([{ ...override, validUntil: new Date('2026-10-16T23:00Z') }], 'member', now).length, 0);
  assert.equal(effectivePatientLimits([override, { ...override, id: 'new', version: 2, revokedAt: now }], 'member', now).length, 0);
  assert.equal(screen({ overrides: [{ ...override, active: false }] }).requiresReview, true);
});

test('independent patient minima and maxima survive unrelated updates', () => {
  const floor = { ...override, id: 'patient-floor', replacesRuleId: null, operator: 'GREATER_THAN_OR_EQUAL', threshold: 1000 };
  const ceiling = { ...override, id: 'patient-ceiling', replacesRuleId: null };
  assert.equal(effectivePatientLimits([floor, ceiling], 'member', now).length, 2);
  const updatedCeiling = { ...ceiling, id: 'ceiling-v2', version: 2, threshold: 1600 };
  assert.deepEqual(new Set(effectivePatientLimits([floor, ceiling, updatedCeiling], 'member', now).map(row => row.id)), new Set(['patient-floor', 'ceiling-v2']));
});

test('approval rule stamps change with applicable versions, suspension and patient effective dates', () => {
  const policy = { id: 'policy', condition: 'HYPERTENSION', policyVersion: 'v1', updatedAt: now, state: 'ACTIVE' };
  const key = clinicalRuleKey(clinicalRuleSnapshot('member', [], [policy], now));
  assert.equal(key, clinicalRuleKey(clinicalRuleSnapshot('member', [], [policy], now)));
  for (const changed of [{ ...policy, policyVersion: 'v2' }, { ...policy, state: 'SUSPENDED' }])
    assert.notEqual(key, clinicalRuleKey(clinicalRuleSnapshot('member', [], [changed], now)));
  const future = { ...override, validFrom: new Date('2026-10-18T00:00Z') };
  assert.equal(key, clinicalRuleKey(clinicalRuleSnapshot('member', [future], [policy], now)));
  assert.notEqual(key, clinicalRuleKey(clinicalRuleSnapshot('member', [future], [policy], new Date('2026-10-19'))));
  assert.equal(key, clinicalRuleKey(clinicalRuleSnapshot('another', [override], [policy], now)));
});

test('ingredient rules use term boundaries and preserve hard-block versus warning semantics', () => {
  const rule = { id: 'ham-rule', condition: 'HYPERTENSION', matchingTerms: ['ham'], severity: 'HARD_BLOCK' };
  assert.equal(screen({ ingredientRules: [rule], ingredientNames: ['champorado'] }).blocked, false);
  assert.equal(screen({ ingredientRules: [rule], ingredientNames: ['sliced ham'] }).blocked, true);
  assert.equal(screen({ ingredientRules: [{ ...rule, severity: 'FLAG' }], ingredientNames: ['sliced ham'] }).blocked, false);
});

test('saved profile summary includes intake details without inventing historic values', () => {
  const summary = reportProfileSummary({ profile: { age: 24, biologicalSex: 'FEMALE', heightCm: 170, weightKg: 65, activityLevel: 'LIGHTLY_ACTIVE', shoppingDayOfWeek: 0 },
    conditions: ['DIABETES'], allergens: ['SHELLFISH'], safetyEntries: [{ domain: 'INTOLERANCE', displayName: 'Lactose' }] });
  assert.equal(summary.find(row => row.label === 'Age')?.value, '24 years');
  assert.equal(summary.find(row => row.label === 'Activity level')?.value, 'Lightly active');
  assert.equal(summary.find(row => row.label === 'Biological sex')?.value, 'Female');
  assert.equal(summary.find(row => row.label === 'Meal times')?.value, 'Not recorded');
  assert.equal(summary.find(row => row.label === 'Target weight')?.value, 'Not recorded');
});

test('patient limit input rejects incompatible units, reversed dates, invalid energy nutrients and unrecognized fields', () => {
  const draft = { condition: 'DIABETES', nutrient: 'CARBOHYDRATE_G', operator: 'LESS_THAN_OR_EQUAL', threshold: 50,
    unit: 'g', basis: 'PER_SERVING', severity: 'FLAG', rationale: 'Individual treatment context recorded.', sourceTitle: 'Reviewed care plan', sourceCitation: 'https://example.org/care-plan',
    validFrom: now.toISOString(), validUntil: null, expectedProfileRevision: 2 };
  assert(patientNutritionLimitSchema.safeParse(draft).success);
  for (const change of [{ unit: 'mg' }, { threshold: -1 }, { validUntil: '2026-10-01T00:00:00.000Z' }, { basis: 'PERCENT_OF_DAILY_CALORIES', unit: '%', nutrient: 'SODIUM_MG' }, { active: true }])
    assert(!patientNutritionLimitSchema.safeParse({ ...draft, ...change }).success);
});

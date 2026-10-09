import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { remainingCycleWindow } from '../src/domain/acknowledged-cycle-rebuild.policy';
import { publishMealClarificationSchema } from '../src/domain/clinical-clarification.policy';

test('acknowledged repair includes only remaining Manila dates and retains plan type', () => {
  const cycle = { planType: 'WEEKLY' as const, startDate: new Date('2026-10-05T00:00:00+08:00'), endDate: new Date('2026-10-11T00:00:00+08:00') };
  assert.deepEqual(remainingCycleWindow(cycle, new Date('2026-10-09T16:01:00Z')), {
    planType: 'WEEKLY', startDate: new Date('2026-10-10T00:00:00+08:00'), numDays: 2,
  });
  assert.equal(remainingCycleWindow(cycle, new Date('2026-10-11T16:00:00Z')), null);
  assert.equal(remainingCycleWindow(cycle, new Date('2026-10-11T15:59:59Z'))?.numDays, 1);
});

test('future repair starts at the original window and invalid oversized windows are refused', () => {
  const cycle = { planType: 'STARTER' as const, startDate: new Date('2026-10-12T00:00:00+08:00'), endDate: new Date('2026-10-14T00:00:00+08:00') };
  assert.deepEqual(remainingCycleWindow(cycle, new Date('2026-10-10T00:00:00Z')), { planType: 'STARTER', startDate: cycle.startDate, numDays: 3 });
  assert.equal(remainingCycleWindow({ ...cycle, endDate: new Date('2026-11-14T00:00:00+08:00') }), null);
});

test('meal clarification requests require opened context and cannot carry profile edits or actor identities', () => {
  const payload = { profileRevision: 1, scopeKey: 'scope', expectedContextKey: 'a'.repeat(64), title: 'Please clarify', questions: [{ id: 'detail', type: 'TEXT', required: true, label: 'What has changed?' }], requestKey: randomUUID() };
  assert.equal(publishMealClarificationSchema.safeParse(payload).success, true);
  for (const invalid of [{ ...payload, expectedContextKey: undefined }, { ...payload, expectedContextKey: 'stale' }, { ...payload, conditions: ['NONE'] }, { ...payload, authorUserId: 'spoofed' }, { ...payload, sourceMealPlanId: 'another' }])
    assert.equal(publishMealClarificationSchema.safeParse(invalid).success, false);
});

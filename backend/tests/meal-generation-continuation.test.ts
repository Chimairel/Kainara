import assert from 'node:assert/strict';
import test from 'node:test';
import { MealPlanCycleStatus, MealType } from '@prisma/client';
import { AppError } from '../src/errors/AppError';
import {
  canResumePartialCycle,
  remainingGenerationSlots,
  continuationRetryAt,
} from '../src/domain/meal-generation-continuation.policy';
import { earliestMissingDay } from '../src/domain/meal-generation-gap.policy';

const now = new Date('2026-10-09T04:00:00Z');
const cycle = {
  status: MealPlanCycleStatus.ACTIVE,
  startDate: new Date('2026-10-04T16:00:00Z'),
  endDate: new Date('2026-10-10T16:00:00Z'),
  shoppingDeadlineAt: new Date('2026-10-04T00:00:00Z'),
  shoppingStartedAt: null,
  incompleteAcknowledgedAt: null,
  profileAdaptationState: 'CURRENT',
  snapshot: { profileRevision: 2, safetyRevision: 1 },
};
const profile = { revision: 2, safetyRevision: 1 };

test('continuation preserves earliest remaining days and never backdates expired gaps', () => {
  const occupied = [{ scheduledDate: new Date('2026-10-08T16:00:00Z'), mealType: MealType.LUNCH }];
  const remaining = remainingGenerationSlots(cycle.startDate, 21, occupied, now);
  assert.equal(remaining.length, 8);
  assert.deepEqual(
    earliestMissingDay(remaining).map((slot) => slot.mealType),
    [MealType.BREAKFAST, MealType.DINNER]
  );
  assert.ok(remaining.every((slot) => slot.dayNumber >= 5));
  assert.deepEqual(remainingGenerationSlots(cycle.startDate, 21, [], new Date('2026-10-12T00:00:00Z')), []);
});

test('completed job recovery remains limited to current, unfrozen, matching profiles', () => {
  assert.equal(canResumePartialCycle(cycle, profile, now), true);
  for (const patch of [
    { shoppingStartedAt: now },
    { incompleteAcknowledgedAt: now },
    { snapshot: null },
    { status: MealPlanCycleStatus.COMPLETED },
    { status: MealPlanCycleStatus.SUPERSEDED },
    { status: MealPlanCycleStatus.REVALIDATION_REQUIRED },
    { profileAdaptationState: 'REBUILD_REQUIRED' },
    { endDate: new Date('2026-10-07T16:00:00Z') },
    { startDate: new Date('2026-10-11T16:00:00Z'), endDate: new Date('2026-10-17T16:00:00Z') },
  ])
    assert.equal(canResumePartialCycle({ ...cycle, ...patch }, profile, now), false);
  assert.equal(canResumePartialCycle(cycle, { ...profile, revision: 3 }, now), false);
  assert.equal(canResumePartialCycle(cycle, { ...profile, safetyRevision: 2 }, now), false);
});

test('provider outages retry with bounded backoff while validation and safety failures stop', () => {
  for (const code of ['AI_TIMEOUT', 'AI_HIGH_DEMAND', 'AI_CONNECTION_ERROR', 'AI_UNAVAILABLE']) {
    assert.equal(
      continuationRetryAt(new AppError('Temporary fault', 503, code), 1, now)?.getTime(),
      now.getTime() + 60_000
    );
    assert.ok(
      continuationRetryAt(new AppError('Temporary fault', 503, code), 20, now)!.getTime() <= now.getTime() + 3_600_000
    );
  }
  for (const code of [
    'AI_INVALID_RESPONSE',
    'AI_SERVICE_CONFIGURATION',
    'PROFILE_CHANGED',
    'NO_REVIEW_FREE_SOURCE',
    'FOOD_EVIDENCE_CHANGED',
  ]) {
    assert.equal(continuationRetryAt(new AppError('Needs resolution', 409, code), 1, now), null);
  }
  assert.equal(continuationRetryAt(new Error('DEFINITE_CONFLICT'), 1, now), null);
});

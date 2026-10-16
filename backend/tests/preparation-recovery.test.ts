import assert from 'node:assert/strict';
import test from 'node:test';
import { CurrentPlanPreparationService } from '../src/services/current-plan-preparation.service';
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';
import { MealGenerationService } from '../src/services/meal-generation.service';

test('a fresh profile wakeup is replayed after the older preparation fails; duplicate wakeups coalesce', async () => {
  const original = UpcomingPlanPreparationService.ensureForUser;
  const originalError = console.error;
  let release!: () => void;
  let started!: () => void;
  const opened = new Promise<void>(resolve => { started = resolve; });
  const gate = new Promise<void>(resolve => { release = resolve; });
  const dates: number[] = [];
  UpcomingPlanPreparationService.ensureForUser = async (_user, date) => {
    dates.push(date!.getTime());
    if (dates.length === 1) { started(); await gate; throw new Error('PROFILE_CHANGED'); }
    return { state: 'NOT_OPEN', planGroupId: null };
  };
  console.error = () => undefined;
  try {
    UpcomingPlanPreparationService.triggerNonBlocking('revision-race', new Date(1));
    await opened;
    UpcomingPlanPreparationService.triggerNonBlocking('revision-race', new Date(2));
    UpcomingPlanPreparationService.triggerNonBlocking('revision-race', new Date(3));
    release();
    for (let index = 0; index < 10 && dates.length < 2; index++) await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(dates, [1, 3]);
  } finally { release(); UpcomingPlanPreparationService.ensureForUser = original; console.error = originalError; }
});

test('background page recovery does not retry future jobs while the first plan failed or is running', async () => {
  const originalCurrent = CurrentPlanPreparationService.ensureForUser;
  const originalUpcoming = MealGenerationService.ensureUpcomingPlanForUser;
  let futureAttempts = 0;
  MealGenerationService.ensureUpcomingPlanForUser = async () => {
    futureAttempts++;
    return { state: 'NOT_OPEN', planGroupId: null };
  };
  try {
    for (const state of ['NOT_READY', 'FAILED', 'PREPARING'] as const) {
      CurrentPlanPreparationService.ensureForUser = async () => ({ state, planGroupId: null });
      for (let index = 0; index < 3; index++) await UpcomingPlanPreparationService.ensureForUser('fixture');
    }
    assert.equal(futureAttempts, 0);
    CurrentPlanPreparationService.ensureForUser = async () => ({ state: 'EXISTING', planGroupId: 'fixture-plan' });
    await UpcomingPlanPreparationService.ensureForUser('fixture');
    assert.equal(futureAttempts, 1, 'An existing current cycle still permits upcoming preparation.');
  } finally {
    CurrentPlanPreparationService.ensureForUser = originalCurrent;
    MealGenerationService.ensureUpcomingPlanForUser = originalUpcoming;
  }
});

test('a wakeup arriving as the drain finishes is not lost during finalization', async () => {
  const original = UpcomingPlanPreparationService.ensureForUser;
  const dates: number[] = [];
  UpcomingPlanPreparationService.ensureForUser = (_user, date) => {
    dates.push(date!.getTime());
    const result = { state: 'NOT_OPEN' as const, planGroupId: null };
    if (dates.length > 1) return Promise.resolve(result);
    return { then(resolve: (value: typeof result) => void) {
      resolve(result);
      queueMicrotask(() => UpcomingPlanPreparationService.triggerNonBlocking('finishing-race', new Date(2)));
    } } as unknown as ReturnType<typeof original>;
  };
  try {
    UpcomingPlanPreparationService.triggerNonBlocking('finishing-race', new Date(1));
    for (let index = 0; index < 10 && dates.length < 2; index++) await new Promise<void>(resolve => setImmediate(resolve));
    assert.deepEqual(dates, [1, 2]);
  } finally { UpcomingPlanPreparationService.ensureForUser = original; }
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { CurrentPlanPreparationService } from '../src/services/current-plan-preparation.service';
import { UpcomingPlanPreparationService } from '../src/services/upcoming-plan-preparation.service';
import { MealGenerationService } from '../src/services/meal-generation.service';

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

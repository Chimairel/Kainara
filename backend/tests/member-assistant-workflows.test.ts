import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { assistantDirectAction, assistantStaticReply } from '../src/domain/member-assistant-information';
import { assistantInputSchema } from '../src/domain/member-assistant.policy';
import { MemberAssistantPlanService as Plan, assistantMealStatusTarget } from '../src/services/member-assistant-plan.service';
import { MemberAssistantService as Assistant } from '../src/services/member-assistant.service';
import { MemberAssistantUsageService as Usage } from '../src/services/member-assistant-usage.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { NutritionReportService } from '../src/services/nutrition-report.service';
import { PlanningReadinessService } from '../src/services/planning-readiness.service';

function delegate(t: TestContext, target: object, name: string, value: unknown) {
  const record = target as Record<string, unknown>; const old = record[name]; record[name] = value;
  t.after(() => { record[name] = old; });
}

test('purpose and requirement questions precede log-weight navigation, with an unchanged-details option', () => {
  for (const question of ['why do i need to log my weight every week?', 'Do I have to record weight weekly?',
    'why log my weight?', 'is weekly weight mandatory?', 'nothing changed in my weekly check-in',
    'Bakit kailangan mag log ng timbang bawat linggo?', 'walang nagbago sa weekly check in']) {
    const answer = assistantStaticReply(question); assert.ok(answer, question);
    assert.match(answer.text, /unchanged|walang nagbago/, question);
    assert.doesNotMatch(answer.text, /^To record your latest weight/, question);
    assert.ok(answer.links.some(link => link.href === '/dashboard'), question);
  }
  assert.match(assistantStaticReply('how do I log my weight?')!.text, /Log today’s weight/);
  assert.match(assistantStaticReply('what if I miss my weekly check-in?')!.text, /recorded as missed/);
  assert.match(assistantStaticReply('my weight is not saving')!.text, /validation message/);
});

test('starter, acknowledgment, question and hold explanations preserve separate workflow boundaries', () => {
  const pairs = [
    ['what is a starter plan?', 'bridges the days'], ['why is my starter only one day?', 'day after'],
    ['why are there not seven days in my plan?', 'starter'], ['ano ang starter plan?', 'starter plan'],
    ['why do I need to acknowledge my report?', 'different steps'], ['I already read my nutrition guidance but am blocked', 'correct version'],
    ['I answered the RND meal question, why is it still pending?', 'still needs to review'],
    ['where do I answer a profile clarification?', 'Health details'],
    ['why are meals pending?', 'separate checks'], ['why is my profile awaiting review again?', 'another check'],
    ['why is next week still preparing?', 'separate dates'], ['why can I not swap meals?', 'remaining cycle allowance'],
    ['does a checked grocery mean I ate it?', 'not food eaten'], ['can I log a future meal as eaten?', 'future meal'],
  ];
  for (const [question, fragment] of pairs) assert.ok(assistantStaticReply(question)?.text.includes(fragment), question);
  for (const question of ['how much protein should I eat for diabetes?', 'what is the nutrition of sinigang?',
    'what is the best diet for kidney disease?']) assert.equal(assistantStaticReply(question), null, question);
});

test('meal permission asks use a free status path and extract the dish without interpreting a condition as saved data', () => {
  for (const [question, target] of [['can I eat adobo if I have diabetes?', 'adobo'],
    ['can I have sinigang with a shrimp allergy?', 'sinigang'], ['is Beef Ribs Sinigang safe for me?', 'beef ribs sinigang'],
    ['is it safe to eat adobo if I am pregnant?', 'adobo'], ['Pwede ba ang sinigang kung may hypertension ako?', 'sinigang'],
    ['Pwede ba akong kumain ng adobo kung may diabetes ako?', 'adobo'],
    ['can I eat Beef Ribs Sinigang on 2026-10-16?', 'beef ribs sinigang']]) {
    assert.equal(assistantDirectAction(question), 'MEAL_STATUS', question);
    assert.equal(assistantStaticReply(question), null, question);
    assert.equal(assistantMealStatusTarget(question), target, question);
  }
  assert.equal(assistantMealStatusTarget('can I eat this if I have allergies?'), null);
  assert.notEqual(assistantDirectAction('can I have a Health plan?'), 'MEAL_STATUS');
  assert.equal(assistantDirectAction('why is my meal pending?'), 'PLAN_STATUS');
});

test('status paths stay free at zero credits/during cooldown, and ambiguous food never reads member tables', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Usage, 'allowance', async () => ({ tier: 'FREE', cap: 5, used: 5, remaining: 0,
    resetsAt: new Date().toISOString(), nextAiRequestAt: new Date(Date.now() + 60000).toISOString() }));
  for (const method of ['prepare', 'reserve'] as const) t.mock.method(Usage, method, async () => { throw Error('No provider or receipt'); });
  t.mock.method(Plan, 'planningStatus', async () => ({ text: 'Owned public notice', source: 'SYSTEM', creditsUsed: 0 }));
  t.mock.method(MealPlanCycleService, 'getCurrentCycleWithClearance', async () => { throw Error('No unresolved meal read'); });
  for (const message of ['check my planning status', 'can I eat this if I have diabetes?']) {
    const result = await Assistant.message('owner', assistantInputSchema.parse({ requestKey: randomUUID(), message, allowAi: true }));
    assert.equal(result.confirmationRequired, false); assert.equal('reply' in result && result.reply.creditsUsed, 0);
    assert.equal(result.allowance.remaining, 0);
  }
});

test('planning status uses existing owner-scoped public notices and reports acknowledgment separately', async t => {
  t.mock.method(PlanningReadinessService, 'getForUser', async (owner: string) => {
    assert.equal(owner, 'owner'); return { status: 'BLOCKED_PROFILE_REVIEW', canRequestPlan: false,
      title: 'Health profile awaiting nutritionist review', message: 'Public waiting notice', actionPath: '/profile/clinical-evidence' };
  });
  t.mock.method(NutritionReportService, 'getReport', async (owner: string) => {
    assert.equal(owner, 'owner'); return { version: 4, acknowledgedAt: null, isStale: false,
      planningContext: { activeVersion: 3, pendingChanges: true } } as never;
  });
  const reply = await Plan.planningStatus('owner');
  assert.match(reply.text, /Public waiting notice/); assert.match(reply.text, /not acknowledged/);
  assert.match(reply.text, /Active planning version: 3/); assert.match(reply.text, /not approval of every meal/);
  assert.equal(reply.links![0].href, '/profile/clinical-evidence');
});

test('exact owned meal status requires current clearance and date, and a label alone never establishes clearance', async t => {
  const now = new Date('2026-10-16T02:00:00Z'); let ready = true; let revalidate = false; let rowDate = new Date('2026-10-15T16:00:00Z');
  t.mock.method(MealPlanCycleService, 'getCurrentCycleWithClearance', async (owner: string) => {
    assert.equal(owner, 'owner'); return { cycle: { id: 'owned-cycle' }, clearedIds: ready ? ['meal'] : [] } as never;
  });
  delegate(t, prisma.mealPlan, 'findMany', async (query: any) => {
    assert.equal(query.where.userId, 'owner'); assert.equal(query.where.planGroupId, 'owned-cycle');
    assert.equal(query.where.supersededByMealPlanId, null); assert.equal(query.take, 6);
    assert.deepEqual(query.where.scheduledDate, { gte: rowDate, lt: new Date(+rowDate + 86400000) });
    return [{ id: 'meal', mealName: 'Beef Ribs Sinigang', mealType: 'LUNCH', scheduledDate: rowDate,
      status: 'APPROVED', requiresSafetyRevalidation: revalidate }] as never;
  });
  const question = 'can I eat Beef Ribs Sinigang on 2026-10-16 if I have diabetes?';
  const reply = await Plan.mealStatus('owner', question, now);
  assert.match(reply.text, /saved planning context/); assert.match(reply.text, /not medical clearance/);
  assert.match(reply.text, /does not update or verify your profile/);
  ready = false;
  assert.match((await Plan.mealStatus('owner', question, now)).text, /not currently cleared/);
  ready = true; revalidate = true;
  assert.match((await Plan.mealStatus('owner', question, now)).text, /not currently cleared/);
  revalidate = false; rowDate = new Date('2026-10-17T16:00:00Z');
  assert.match((await Plan.mealStatus('owner', question.replace('2026-10-16', '2026-10-18'), now)).text, /future meals cannot be marked eaten early/);
});

test('ambiguous, absent, substring and different-cycle meal names cannot claim a selected approval', async t => {
  t.mock.method(MealPlanCycleService, 'getCurrentCycleWithClearance', async () => ({ cycle: { id: 'cycle' }, clearedIds: ['one', 'two'] }) as never);
  let names = ['Chicken Adobo', 'Pork Adobo'];
  delegate(t, prisma.mealPlan, 'findMany', async () => names.map((name, index) => ({ id: index ? 'two' : 'one', mealName: name,
    mealType: 'LUNCH', scheduledDate: new Date(), status: 'APPROVED', requiresSafetyRevalidation: false })) as never);
  assert.match((await Plan.mealStatus('owner', 'can I eat adobo if I have diabetes?')).text, /I have not selected one/);
  names = [];
  assert.match((await Plan.mealStatus('owner', 'can I eat adobo?')).text, /does not mean the dish is safe or unsafe/);
  names = ['Salpora'];
  assert.match((await Plan.mealStatus('owner', 'can I eat sal?')).text, /could not identify/);
  assert.match((await Plan.mealStatus('owner', 'can I eat adobo on 2026-02-30?')).text, /valid YYYY-MM-DD/);
});

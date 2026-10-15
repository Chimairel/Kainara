import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { assistantDirectAction, assistantStaticReply } from '../src/domain/member-assistant-information';
import { assistantInputSchema } from '../src/domain/member-assistant.policy';
import { buildGroceryDays } from '../src/domain/grocery-day.policy';
import { MemberAssistantPlanService } from '../src/services/member-assistant-plan.service';
import { MemberAssistantService } from '../src/services/member-assistant.service';
import { MemberAssistantUsageService as Usage } from '../src/services/member-assistant-usage.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { GroceryService } from '../src/services/grocery.service';

test('daily questions route to free data while recommendations and other dates do not silently use today', () => {
  for (const q of ['whats my current meal?', 'what are my meals today?', 'show my lunch', 'what is for dinner?']) {
    assert.equal(assistantDirectAction(q), 'CURRENT_MEALS', q); assert.equal(assistantStaticReply(q), null);
  }
  for (const q of ['what are the ingredients i should by for this day?', 'what groceries should I buy today?', 'ingredients needed today'])
    assert.equal(assistantDirectAction(q), 'GROCERIES', q);
  for (const q of ['what should I eat today?', 'what is the nutrition of my lunch?', 'what are my meals tomorrow?', 'what ingredients for Monday?'])
    assert.ok(!['CURRENT_MEALS', 'GROCERIES'].includes(assistantDirectAction(q) ?? ''), q);
});

test('math, completion holds, profile destinations, questions and support fallback are prepared information', () => {
  const pairs = [
    ['how did kainara calculate my meals?', '30%'], ['explain BMR', '6.25'], ['what is TDEE?', '1.375'],
    ['how are my protein targets calculated?', '12.5%'], ['how are calories split between meals?', '15%'],
    ['why are lunch calories higher?', '40%'], ['how did you calculate my calorie target?', 'acknowledged planning report'],
    ['how is rice nutrition calculated?', '100'], ['why i cant mark as done a meal?', 'seven-day'],
    ['where can I change my health condition?', 'Conditions & allergies'], ['where do I answer a meal question?', 'Meal plan'],
    ['how can I contact my RND?', 'profile questions in Health details'],
  ];
  for (const [q, text] of pairs) assert.ok(assistantStaticReply(q)?.text.includes(text), q);
  assert.ok(assistantStaticReply('unknown app setting')?.links.some(link => link.label === 'Help' && link.href === '/help'));
  assert.ok(assistantStaticReply('where can I change my health condition?')?.links.some(link => link.href === '/profile/health'));
  assert.equal(assistantStaticReply('how do I calculate the protein I should eat for diabetes?'), null);
});

test('day requirements reuse aggregation, separate dates, include rice and preserve unknown quantities', () => {
  const base = { ingredients: [{ ingredientName: 'Chicken', quantity: 0.1, unit: 'kg' }, { ingredientName: 'Salt', quantity: null, unit: null }],
    servingComponents: [{ quantityG: 225, foodItem: { name: 'Cooked rice', category: 'Grains' } }] };
  const days = buildGroceryDays([
    { ...base, scheduledDate: new Date('2026-10-15T16:00:00Z') },
    { ...base, scheduledDate: new Date('2026-10-16T03:00:00Z') },
    { ...base, scheduledDate: new Date('2026-10-16T16:00:00Z') },
  ], new Date('2026-10-16T00:00:00+08:00'), new Date('2026-10-18T00:00:00+08:00'));
  assert.equal(days[0].date, '2026-10-16'); assert.equal(days[0].clearedMealCount, 2);
  assert.equal(days[0].items.find(i => i.ingredientName === 'Chicken')?.quantity, 200);
  assert.equal(days[0].items.find(i => i.ingredientName === 'Cooked rice')?.quantity, 450);
  assert.equal(days[0].items.find(i => i.ingredientName === 'Salt')?.quantity, null);
  assert.equal(days[1].clearedMealCount, 1); assert.equal(days[2].items.length, 0);
});

test('current meals are owner/cycle/date scoped, distinguish holds and never claim consumption', async t => {
  const now = new Date('2026-10-15T17:00:00Z');
  t.mock.method(MealPlanCycleService, 'getCurrentCycleWithClearance', async (owner: string) => {
    assert.equal(owner, 'member'); return { cycle: { id: 'owned-cycle' }, clearedIds: ['ready'] } as any;
  });
  const originalRead = prisma.mealPlan.findMany;
  t.after(() => { prisma.mealPlan.findMany = originalRead; });
  prisma.mealPlan.findMany = (async (query: any) => {
    assert.equal(query.where.userId, 'member'); assert.equal(query.where.planGroupId, 'owned-cycle');
    assert.equal(query.where.scheduledDate.gte.toISOString(), '2026-10-15T16:00:00.000Z');
    assert.equal(query.where.mealType, 'LUNCH');
    return [{ id: 'ready', mealName: 'Ready lunch', mealType: 'LUNCH', status: 'APPROVED' },
      { id: 'held', mealName: 'Held lunch', mealType: 'LUNCH', status: 'PENDING_REVIEW' }] as any;
  }) as typeof prisma.mealPlan.findMany;
  const reply = await MemberAssistantPlanService.currentMeals('member', 'show my lunch', now);
  assert.match(reply.text, /cleared for the plan/); assert.match(reply.text, /not cleared/);
  assert.match(reply.text, /not food recorded as eaten/); assert.equal(reply.creditsUsed, 0);
});

test('today ingredients reuse grocery projection and do not subtract invented pantry inventory', async t => {
  t.mock.method(GroceryService, 'getTodayIngredients', async (owner: string) => {
    assert.equal(owner, 'member'); return { days: [{ date: '2026-10-16', clearedMealCount: 1, items: [
      { ingredientName: 'Rice', quantity: 225, unit: 'g' }, { ingredientName: 'Salt', quantity: null, unit: null },
    ] }] } as any;
  });
  const reply = await MemberAssistantPlanService.groceries('member', new Date('2026-10-15T17:00:00Z'));
  assert.match(reply.text, /225.0 g/); assert.match(reply.text, /amount not recorded/);
  assert.match(reply.text, /not a remaining-to-buy calculation/);
  assert.equal(reply.links?.[0].href, '/grocery?day=2026-10-16');
});

test('personalized reads work at zero credits and during cooldown without consent, reservation or provider', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Usage, 'allowance', async () => ({ tier: 'FREE', cap: 5, used: 5, remaining: 0, resetsAt: new Date().toISOString(), nextAiRequestAt: new Date(Date.now() + 60000).toISOString() } as any));
  for (const name of ['prepare', 'reserve'] as const) t.mock.method(Usage, name, async () => { throw Error('No provider admission allowed'); });
  for (const [question, method] of [['whats my current meal?', 'currentMeals'], ['what ingredients should I buy today?', 'groceries']] as const) {
    t.mock.method(MemberAssistantPlanService, method, async () => ({ text: 'Owned current records', source: 'SYSTEM', creditsUsed: 0 }));
    const result = await MemberAssistantService.message('member', assistantInputSchema.parse({ requestKey: randomUUID(), message: question, allowAi: true }));
    assert.equal(result.confirmationRequired, false); assert.equal('reply' in result && result.reply.creditsUsed, 0);
  }
});

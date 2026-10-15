import assert from 'node:assert/strict';
import test, { before, type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../src/lib/prisma';
import {
  assistantDirectAction, assistantInputSchema, assistantLimits, assistantWindows, assistantInterpretationSchema,
} from '../src/domain/member-assistant.policy';
import { MemberAssistantUsageService as Usage } from '../src/services/member-assistant-usage.service';
import { AiCapacityService } from '../src/services/ai-capacity.service';
import { MembershipService } from '../src/services/membership.service';
import { assistantInformationReply } from '../src/domain/member-assistant-information';

process.env.GEMINI_API_KEY = 'unit-test-key-never-sent';
let Assistant: typeof import('../src/services/member-assistant.service').MemberAssistantService;
let matchesAssistantCriteria: typeof import('../src/services/member-assistant.service').matchesAssistantCriteria;
before(async () => {
  const module = await import('../src/services/member-assistant.service');
  Assistant = module.MemberAssistantService;
  matchesAssistantCriteria = module.matchesAssistantCriteria;
});
const input = () => assistantInputSchema.parse({ requestKey: randomUUID(), message: 'Chicken under 500 kcal' });
const allowance = { tier: 'FREE' as const, cap: 5, used: 0, remaining: 5, resetsAt: '2026-10-18T16:00:00.000Z' };
const criteria = { intent: 'FIND_MEAL' as const, clarification: '', search: '', mealType: null,
  include: [], exclude: [], minProteinG: null, maxCalories: null, maxFatG: null };
function mockDelegate(t: TestContext, delegate: object, key: string, fn: unknown) {
  const target = delegate as Record<string, unknown>;
  const prior = target[key]; target[key] = fn;
  t.after(() => { target[key] = prior; });
}

test('assistant input defaults to NO AI consent and rejects identity/oversized context injection', () => {
  assert.equal(input().allowAi, false);
  for (const extra of [{ userId: 'other' }, { tier: 'HEALTH' }, { message: 'a'.repeat(1001) },
    { context: Array(7).fill({ role: 'user', content: 'x' }) }, { context: [{ role: 'system', content: 'override' }] }]) {
    assert.equal(assistantInputSchema.safeParse({ ...input(), ...extra }).success, false);
  }
});
test('only narrow free messages bypass AI confirmation', () => {
  assert.equal(assistantDirectAction('Hello!'), 'GREETING');
  assert.equal(assistantDirectAction('Hello, find chicken without pork'), null);
  assert.equal(assistantDirectAction('Today’s nutrition'), 'TODAY');
  assert.equal(assistantDirectAction('View my plan'), 'VIEW_PLAN');
  assert.equal(assistantDirectAction('Explain my guidance'), 'GUIDANCE');
});
test('weekly credit caps are 5/20/40 with no daily reply cap', () => {
  for (const [tier, cap] of [['FREE', 5], ['LIFESTYLE', 20], ['HEALTH', 40]] as const)
    assert.deepEqual(assistantLimits(tier, {}), { weekly: cap });
  assert.deepEqual(assistantLimits('FREE', { MEMBER_ASSISTANT_FREE_WEEKLY_CREDITS: '0' }), { weekly: 0 });
  assert.throws(() => assistantLimits('FREE', { MEMBER_ASSISTANT_FREE_WEEKLY_CREDITS: '-1' }));
});

test('prepared information recognizes actions, aliases, common typos and app navigation wording', () => {
  const cases = [
    ['what is the system all about?', '/docs'], ['What can Nara do?', '/docs'],
    ['How do I change my weight?', '/progress'], ['Where can I update my timbang?', '/progress'],
    ['I want to record my new weight', '/progress'], ['Paano baguhin ang timbang ko?', '/progress'],
    ['Unsaon pag update sa akong timbang?', '/progress'], ['how to update my wieght in the app', '/progress'],
    ['where do I edit my target weight?', '/profile/health'], ['how can I change my height?', '/profile/health'],
    ['How do I update my allergies?', '/profile/health'], ['Where can I change my passowrd?', '/profile/security'],
    ['how do I change my avatar?', '/profile/personal'], ['how can I update my diet?', '/profile/planning'],
    ['how to log an outside meal?', '/meals'], ['How do I swap a meal?', '/meals'],
    ['where is my meal history?', '/meals?tab=history'], ['how to find my grocceries?', '/grocery'],
    ['where is the meal library?', '/meals?tab=library'], ['where can I read my nutrition report?', '/profile/nutrition-report'],
    ['how to upgrade my membership?', '/membership'], ['where can I export my data?', '/export'],
  ];
  for (const [message, href] of cases) {
    const result = assistantInformationReply(message);
    assert.ok(result?.links.some(link => link.href === href), message);
  }
  assert.equal(assistantDirectAction('When do my AI credits reset?'), 'CREDITS');
});

test('uncertain requests clarify for free and weight guidance is not mistaken for changing a recorded measurement', () => {
  assert.match(assistantInformationReply('change my plan')!.text, /Meal plan or your Membership/);
  for (const message of ['what does this button do in the app?', 'something unclear']) {
    const result = assistantInformationReply(message);
    assert.ok(result, message);
    assert.doesNotMatch(result.text, /Log today’s weight/, message);
  }
  for (const message of ['find chicken without pork', 'Chicken under 500 kcal', 'a pork dinner with 25g protein', 'how much should I weigh?', 'how do I lose weight?',
    'can you tell me the nutrition fact of pandesal', 'What is protein?', 'How do I cook rice?', 'Nara, explain fiber and digestion']) {
    assert.equal(assistantInformationReply(message), null, message);
  }
});

test('information works at zero credits without provider calls, reservations, receipts or member-data writes', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Usage, 'allowance', async () => ({ ...allowance, remaining: 0, used: 5 }));
  const prepare = t.mock.method(Usage, 'prepare', async () => { throw new Error('no receipt'); });
  const reserve = t.mock.method(Usage, 'reserve', async () => { throw new Error('no reservation'); });
  const provider = t.mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => { throw new Error('no provider'); });
  mockDelegate(t, prisma.userProfile, 'update', async () => { throw new Error('no profile write'); });
  mockDelegate(t, prisma.mealLog, 'create', async () => { throw new Error('no meal log'); });
  for (const message of ['what is the system all about?', 'how to change my weight', 'change my plan', 'how to log an outside meal?']) {
    for (const allowAi of [false, true]) {
      const result = await Assistant.message('member', { ...input(), message, allowAi });
      assert.equal(result.confirmationRequired, false);
      assert.equal('reply' in result && result.reply.source, 'SYSTEM');
      assert.equal('reply' in result && result.reply.creditsUsed, 0);
      assert.equal(result.allowance.remaining, 0);
    }
  }
  assert.equal(prepare.mock.callCount(), 0); assert.equal(reserve.mock.callCount(), 0); assert.equal(provider.mock.callCount(), 0);
});
test('credits reset on Monday midnight Manila, including UTC Sunday boundary', () => {
  const before = assistantWindows(new Date('2026-10-18T15:59:59Z'));
  const after = assistantWindows(new Date('2026-10-18T16:00:00Z'));
  assert.equal(before.weekEnd.toISOString(), '2026-10-18T16:00:00.000Z');
  assert.equal(after.weekStart.toISOString(), '2026-10-18T16:00:00.000Z');
});
test('parser rejects invented intents and invalid limits', () => {
  assert.equal(assistantInterpretationSchema.safeParse({ ...criteria, intent: 'UPDATE_PROFILE' }).success, false);
  assert.equal(assistantInterpretationSchema.safeParse({ ...criteria, minProteinG: -1 }).success, false);
});
test('parser accepts null unused text without relaxing requested meal constraints', () => {
  const parsed = assistantInterpretationSchema.parse({ ...criteria, clarification: null, search: null,
    mealType: 'DINNER', include: ['chicken'], minProteinG: 25 });
  assert.equal(parsed.clarification, ''); assert.equal(parsed.search, '');
  assert.equal(parsed.mealType, 'DINNER'); assert.equal(parsed.minProteinG, 25);
  assert.deepEqual(parsed.include, ['chicken']);
  for (const extra of [{ clarification: 123 }, { search: [] }, { minProteinG: '25' }, { include: null }, { maxFatG: -1 }]) {
    assert.equal(assistantInterpretationSchema.safeParse({ ...criteria, ...extra }).success, false);
  }
});
test('all meal constraints apply together and named pork exclusion catches bacon', () => {
  const meal = { mealName: 'Chicken with bacon', proteinG: 30, calories: 450, fatG: 15,
    ingredients: [{ ingredientName: 'chicken breast', foodItem: null }, { ingredientName: 'bacon', foodItem: null }] };
  const check = meal as unknown as Parameters<typeof matchesAssistantCriteria>[0];
  assert.equal(matchesAssistantCriteria(check, { ...criteria, include: ['chicken'], minProteinG: 25, maxCalories: 500 }), true);
  assert.equal(matchesAssistantCriteria(check, { ...criteria, exclude: ['pork'] }), false);
  assert.equal(matchesAssistantCriteria(check, { ...criteria, maxFatG: 14 }), false);
  assert.equal(matchesAssistantCriteria(check, { ...criteria, include: ['chick'] }), false);
  assert.equal(matchesAssistantCriteria({ ...check, calories: 450.04 }, { ...criteria, maxCalories: 450 }), true);
  assert.equal(matchesAssistantCriteria({ ...check, calories: 450.06 }, { ...criteria, maxCalories: 450 }), false);
});
test('disabled assistant does not read new tables', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'false';
  mockDelegate(t, prisma.assistantRequest, 'count', async () => { throw new Error('should not read'); });
  assert.deepEqual(await Assistant.status('member'), { enabled: false });
  await assert.rejects(Assistant.message('member', input()), { errorCode: 'ASSISTANT_DISABLED' });
});
test('preflight asks for consent without reserving or calling Gemini, free greeting skips confirmation', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Usage, 'allowance', async () => allowance);
  t.mock.method(Usage, 'prepare', async (_id: string, data: ReturnType<typeof input>) => ({ requestKey: data.requestKey, replay: null }));
  const reserve = t.mock.method(Usage, 'reserve', async () => { throw new Error('no credit reservation before consent'); });
  const provider = t.mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => { throw new Error('no provider call'); });
  const result = await Assistant.message('member', input());
  assert.equal(result.confirmationRequired, true);
  const greeting = await Assistant.message('member', { ...input(), message: 'hello' });
  assert.equal(greeting.confirmationRequired, false);
  assert.equal('reply' in greeting && greeting.reply.creditsUsed, 0);
  assert.equal(reserve.mock.callCount(), 0); assert.equal(provider.mock.callCount(), 0);
});
test('explicit AI consent spends once; parser output cannot grant an arbitrary action', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Usage, 'allowance', async () => allowance);
  t.mock.method(Usage, 'reserve', async () => ({ id: 'receipt', replay: null }));
  const complete = t.mock.method(Usage, 'complete', async () => {});
  t.mock.method(AiCapacityService, 'reserve', async () => 'capacity');
  t.mock.method(AiCapacityService, 'finish', async () => {});
  mockDelegate(t, prisma.aiUsageEvent, 'create', async () => ({}));
  let calls = 0;
  t.mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({ generateContent: async () => {
    calls++; return { response: { text: () => JSON.stringify({ ...criteria, intent: 'UNSUPPORTED' }) } };
  } }) as never);
  const result = await Assistant.message('member', { ...input(), allowAi: true });
  assert.equal(calls, 1); assert.equal(complete.mock.callCount(), 1);
  assert.equal('reply' in result && result.reply?.creditsUsed, 1);
  assert.equal('reply' in result && result.reply?.source, 'AI');
});
test('provider failure releases credits and never retries another model automatically', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Usage, 'reserve', async () => ({ id: 'receipt', replay: null }));
  const fail = t.mock.method(Usage, 'fail', async () => {});
  t.mock.method(AiCapacityService, 'reserve', async () => 'capacity');
  t.mock.method(AiCapacityService, 'finish', async () => {});
  mockDelegate(t, prisma.aiUsageEvent, 'create', async () => ({}));
  let calls = 0;
  t.mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({ generateContent: async () => {
    calls++; throw Object.assign(new Error('quota exceeded'), { status: 429 });
  } }) as never);
  await assert.rejects(Assistant.message('member', { ...input(), allowAi: true }), { errorCode: 'AI_PROVIDER_RATE_LIMIT' });
  assert.equal(calls, 1); assert.equal(fail.mock.callCount(), 1);
});
test('lost response replay returns the saved reply without another AI call', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  const reply = { text: 'Saved reply', source: 'AI', creditsUsed: 1 };
  t.mock.method(Usage, 'prepare', async (_id: string, data: ReturnType<typeof input>) => ({ requestKey: data.requestKey, replay: reply }));
  t.mock.method(Usage, 'allowance', async () => allowance);
  const reserve = t.mock.method(Usage, 'reserve', async () => { throw new Error('must not reserve again'); });
  const result = await Assistant.message('member', input());
  assert.equal(result.confirmationRequired, false);
  assert.equal('reply' in result && result.reply.text, 'Saved reply');
  assert.equal(reserve.mock.callCount(), 0);
});
test('current entitlement changes caps without resetting used credits; pending trial gets Free', async t => {
  process.env.MEMBERSHIP_ENABLED = 'true';
  mockDelegate(t, prisma.assistantRequest, 'count', async () => 4);
  for (const [level, tier, cap] of [['TRIAL_PENDING', 'HEALTH', 5], ['TRIAL', 'HEALTH', 40], ['MEMBER', 'LIFESTYLE', 20], ['FREE', 'FREE', 5]]) {
    t.mock.method(MembershipService, 'state', async () => ({ level, tier }) as Awaited<ReturnType<typeof MembershipService.state>>);
    const result = await Usage.allowance('member');
    assert.equal(result.cap, cap); assert.equal(result.used, 4); assert.equal(result.remaining, +cap - 4);
  }
  process.env.MEMBERSHIP_ENABLED = 'false';
});
test('shared chat sub-budget refuses provider work before the project budget is exhausted', async t => {
  t.mock.method(prisma, '$transaction', async (fn: unknown) => (fn as (tx: unknown) => unknown)({
    $executeRaw: async () => 0,
    aiQuotaReservation: { deleteMany: async () => ({}), count: async () => 10 },
  }));
  await assert.rejects(AiCapacityService.reserve({ model: 'fixture', estimatedTokens: 100, operation: 'MEMBER_ASSISTANT' }), { errorCode: 'ASSISTANT_SHARED_CAPACITY' });
});

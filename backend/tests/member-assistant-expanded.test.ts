import assert from 'node:assert/strict';
import { beforeEach } from 'node:test';
import { NaraAnswerService } from '../src/services/nara-answer.service';
beforeEach(t => { if ('mock' in t) { t.mock.method(NaraAnswerService, 'reply', async () => null); t.mock.method(NaraAnswerService, 'questions', async () => []); } });
import test, { before, type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../src/lib/prisma';
import { assistantStaticReply } from '../src/domain/member-assistant-information';
import { assistantInputSchema } from '../src/domain/member-assistant.policy';
import { MemberAssistantUsageService as Usage } from '../src/services/member-assistant-usage.service';
import { AiCapacityService } from '../src/services/ai-capacity.service';
import { WaterService } from '../src/services/water.service';
import { invalidateCatalogueMatching } from '../src/lib/catalogue-matching-cache';

process.env.GEMINI_API_KEY = 'unit-test-key-never-sent';
let Assistant: typeof import('../src/services/member-assistant.service').MemberAssistantService;
let Nutrition: typeof import('../src/services/member-assistant-nutrition.service').MemberAssistantNutritionService;
before(async () => {
  Assistant = (await import('../src/services/member-assistant.service')).MemberAssistantService;
  Nutrition = (await import('../src/services/member-assistant-nutrition.service')).MemberAssistantNutritionService;
});
function delegate(t: TestContext, target: object, name: string, fn: unknown) {
  const object = target as Record<string, unknown>; const old = object[name]; object[name] = fn;
  t.after(() => { object[name] = old; });
}
const allowance = { tier: 'FREE' as const, cap: 5, used: 0, remaining: 5, resetsAt: '2026-10-18T16:00:00Z' };
const interpretation = { intent: 'FOOD_FACTS', clarification: '', search: 'pandesal', mealType: null,
  include: [], exclude: [], minProteinG: null, maxCalories: null, maxFatG: null };

test('audited help recognizes support, workflow and confusing navigation phrases for free', () => {
  const cases = [
    ['how to report issue?', '/help'], ['I found a bug', '/help'], ['How do I contact support?', '/help'],
    ['what does pending review mean?', '/meals'], ['what is the weekly check-in?', '/dashboard'],
    ['how can I get RND feedback?', '/meals?tab=history'], ['why is a meal missing?', '/meals'],
    ['why do I need to acknowledge my report?', '/profile/nutrition-report'], ['do the meal calories include rice?', '/meals'],
    ['forgot my password', '/forgot-password'], ['resend OTP', '/verify-email'], ['where are my health details?', '/profile/clinical-evidence'],
    ['paano magreport ng problema?', '/help'], ['where is todays menu?', '/dashboard'], ['I ate tempura', '/meals'],
    ['Get a copy of my data', '/profile/security'], ['download grocery PDF', '/grocery'], ['what plan do I have?', '/membership'],
    ['Does my food wait for RND approval to count?', '/meals?tab=history'],
  ];
  for (const [question, href] of cases) assert.ok(assistantStaticReply(question)?.links.some(link => link.href === href), question);
  for (const question of ['nutrition facts for pandesal', 'What is protein?', 'how do I cook rice?', 'how do I lose weight?', 'tell me about tocino', 'what is ramen'])
    assert.equal(assistantStaticReply(question), null, question);
});

test('expanded help works at zero credits without a provider or receipt', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Usage, 'allowance', async () => ({ ...allowance, remaining: 0 }));
  t.mock.method(Usage, 'prepare', async () => { throw new Error('no receipt'); });
  t.mock.method(Usage, 'reserve', async () => { throw new Error('no reservation'); });
  t.mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => { throw new Error('no AI'); });
  const result = await Assistant.message('member', assistantInputSchema.parse({ requestKey: randomUUID(), message: 'how to report issue?', allowAi: true }));
  assert.equal(result.confirmationRequired, false);
  assert.equal('reply' in result && result.reply.creditsUsed, 0);
});

test('food facts preserve source/basis, extra nutrients, zero and missing evidence', async t => {
  invalidateCatalogueMatching();
  let reads = 0;
  delegate(t, prisma.foodItem, 'findMany', async (query: { take: number }) => {
    reads++;
    assert.equal(query.take, 6);
    return [{ id: 'fixture', name: 'Pandesal fixture', source: 'FNRI', sourceRecordId: 'fixture-record',
      calories: 210, proteinG: 5, carbsG: 40, fatG: 3, sodium: 0, fiber: 2.2, sugar: null,
      sourceReferenceUrl: 'https://example.invalid/fixture', sourceDataset: 'synthetic' }];
  });
  const result = await Nutrition.facts('pandesal');
  assert.match(result.text, /per 100 g, not per piece/);
  assert.match(result.text, /fixture-record/);
  assert.ok(result.facts?.some(item => item.label === 'Sodium' && item.value === '0.0 mg'));
  assert.ok(result.facts?.some(item => item.label === 'Fiber' && item.value === '2.2 g'));
  assert.equal(result.facts?.some(item => item.label === 'Sugar'), false);
  await Nutrition.facts('pandesal'); assert.equal(reads, 1);
  invalidateCatalogueMatching(); await Nutrition.facts('pandesal'); assert.equal(reads, 2);
});

test('ambiguous and missing composition matches never invent a selected serving or nutrition table', async t => {
  invalidateCatalogueMatching();
  delegate(t, prisma.foodItem, 'findMany', async () => [{ name: 'Pandesal plain', source: 'FNRI' }, { name: 'Pandesal sweet', source: 'FNRI' }]);
  assert.equal((await Nutrition.facts('pandesal')).facts, undefined);
  delegate(t, prisma.foodItem, 'findMany', async () => []);
  const missing = await Nutrition.facts('unknown-food');
  assert.match(missing.text, /couldn’t find a recorded/); assert.equal(missing.facts, undefined);
});

test('related composition matching does not confuse sal with salvadoran or salpora', async t => {
  invalidateCatalogueMatching();
  let queries = 0;
  delegate(t, prisma.foodItem, 'findMany', async () => ++queries === 1 ? [] : [
    { name: 'Bread, pan de sal', source: 'FNRI', calories: 200, proteinG: 5, carbsG: 40, fatG: 3 },
    { name: 'Bread, pound cake type, pan de torta salvadoran', source: 'USDA_FDC', calories: 999 },
    { name: 'Pan Dulce, Salpora de Arroz', source: 'USDA_FDC', calories: 999 },
  ]);
  const reply = await Nutrition.facts('pandesal');
  assert.match(reply.text, /^Bread, pan de sal/);
  assert.equal(reply.facts?.[0].value, '200.0 kcal');
});

test('education uses two bounded provider calls for one completed credit and supplied reference IDs only', async t => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Usage, 'allowance', async () => allowance);
  t.mock.method(Usage, 'reserve', async () => ({ id: 'receipt', replay: null }));
  const complete = t.mock.method(Usage, 'complete', async () => {});
  t.mock.method(AiCapacityService, 'reserve', async () => 'capacity');
  t.mock.method(AiCapacityService, 'finish', async () => {});
  delegate(t, prisma.aiUsageEvent, 'create', async () => ({}));
  let calls = 0;
  t.mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({ generateContent: async () => {
    calls++; return { response: { text: () => JSON.stringify(calls === 1 ? { ...interpretation, intent: 'NUTRITION_QUESTION', search: '' }
      : { text: 'Protein helps build body structures.', sourceIds: ['WHO_DIET'] }) } };
  } }) as never);
  const result = await Assistant.message('member', assistantInputSchema.parse({ requestKey: randomUUID(), message: 'What is protein?', allowAi: true }));
  assert.equal(calls, 2); assert.equal(complete.mock.callCount(), 1);
  assert.equal('reply' in result && result.reply?.creditsUsed, 1);
  assert.equal('reply' in result && result.reply?.references?.[0].href, 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet');
});

test('recovery queries only an owned receipt and cannot invoke AI, reserve or write', async t => {
  t.mock.method(Usage, 'reserve', async () => { throw new Error('no reservation'); });
  t.mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => { throw new Error('no provider'); });
  const key = randomUUID(); const now = new Date();
  delegate(t, prisma.assistantRequest, 'findUnique', async (query: { where: unknown }) => {
    assert.deepEqual(query.where, { userId_requestKey: { userId: 'owner', requestKey: key } });
    return { state: 'SUCCEEDED', response: { text: 'Owned response' }, createdAt: now, leaseUntil: new Date(+now + 90000) };
  });
  assert.deepEqual(await Usage.recover('owner', key, now), { status: 'SUCCEEDED', reply: { text: 'Owned response' }, completedAt: now.toISOString() });
  delegate(t, prisma.assistantRequest, 'findUnique', async () => null);
  assert.deepEqual(await Usage.recover('other-owner', key, now), { status: 'NOT_FOUND' });
});

test('recovery distinguishes active, expired and failed requests without restarting them', async t => {
  const now = new Date();
  for (const [state, lease, expected] of [['PENDING', 1, 'RUNNING'], ['PENDING', -1, 'EXPIRED'], ['FAILED', 1, 'FAILED']] as const) {
    delegate(t, prisma.assistantRequest, 'findUnique', async () => ({ state, leaseUntil: new Date(+now + lease), createdAt: now }));
    assert.equal((await Usage.recover('owner', randomUUID(), now)).status, expected);
  }
});

test('water subtraction preserves a residual smaller than an add-entry minimum', async t => {
  let remaining = 275;
  t.mock.method(prisma, '$transaction', async (fn: unknown) => (fn as (tx: unknown) => unknown)({
    $queryRaw: async () => [], waterLog: { findMany: async () => remaining ? [{ id: 'fixture', amountMl: remaining }] : [],
      delete: async () => { remaining = 0; }, update: async (data: { data: { amountMl: number } }) => { remaining = data.data.amountMl; } },
  }));
  assert.equal((await WaterService.remove('fixture', 250)).totalMl, 25);
  assert.equal((await WaterService.remove('fixture', 250)).totalMl, 0);
});

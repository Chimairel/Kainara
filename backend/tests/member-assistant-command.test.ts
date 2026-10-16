import assert from 'node:assert/strict';
import test, { before, type TestContext } from 'node:test';
import { randomUUID } from 'node:crypto';
import { GoogleGenerativeAI } from '@google/generative-ai';
import prisma from '../src/lib/prisma';
import { assistantAiQuestion, assistantDirectAction, assistantStaticReply } from '../src/domain/member-assistant-information';
import { assistantInputSchema, assistantParserInstruction } from '../src/domain/member-assistant.policy';
import { MemberAssistantUsageService as Usage } from '../src/services/member-assistant-usage.service';
import { AiCapacityService } from '../src/services/ai-capacity.service';
import { assistantAppEvidence, MemberAssistantSystemService } from '../src/services/member-assistant-system.service';

process.env.GEMINI_API_KEY = 'unit-test-key-never-sent';
let Assistant: typeof import('../src/services/member-assistant.service').MemberAssistantService;
before(async () => { Assistant = (await import('../src/services/member-assistant.service')).MemberAssistantService; });
const allowance = { tier: 'FREE' as const, cap: 5, used: 0, remaining: 5, resetsAt: '2026-10-18T16:00:00Z' };
const interpretation = { intent: 'SYSTEM_QUESTION', clarification: '', search: '', mealType: null,
  include: [], exclude: [], minProteinG: null, maxCalories: null, maxFatG: null };
const input = (message: string, allowAi = false) => assistantInputSchema.parse({ requestKey: randomUUID(), message, allowAi });
function provider(t: TestContext, response: (call: number, payload: any) => unknown) {
  let calls = 0;
  t.mock.method(AiCapacityService, 'reserve', async () => 'capacity');
  t.mock.method(AiCapacityService, 'finish', async () => {});
  const delegate = prisma.aiUsageEvent as unknown as Record<string, unknown>; const old = delegate.create;
  delegate.create = async () => ({}); t.after(() => { delegate.create = old; });
  t.mock.method(GoogleGenerativeAI.prototype, 'getGenerativeModel', () => ({ generateContent: async (request: { contents: Array<{ parts: Array<{ text: string }> }> }) => {
    const payload = JSON.parse(request.contents[0].parts[0].text);
    return { response: { text: () => JSON.stringify(response(++calls, payload)) } };
  } }) as never);
  return () => calls;
}
function usage(t: TestContext) {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Usage, 'allowance', async () => allowance);
  t.mock.method(Usage, 'reserve', async () => ({ id: 'receipt', replay: null }));
  t.mock.method(Usage, 'complete', async () => {});
  t.mock.method(Usage, 'fail', async () => {});
}

test('/ai is a per-message prefix, while bare /ai is free help and library permission is not a food-name lookup', () => {
  assert.equal(assistantAiQuestion(' /AI\nwhy weekly weight? '), 'why weekly weight?');
  for (const text of ['/air rice', 'please /ai help', '//ai help']) assert.equal(assistantAiQuestion(text), null);
  assert.equal(assistantAiQuestion('/ai'), '');
  assert.match(assistantStaticReply('/ai')!.text, /only to that message/);
  for (const text of ['/ai how do I log weight?', '/ai can I eat adobo?', '/ai hello']) {
    assert.equal(assistantStaticReply(text), null); assert.equal(assistantDirectAction(text), null);
  }
  for (const text of ['can I eat every meal in the library?', 'can I eat any meal in the library?', 'pwede ba kainin lahat ng nasa library?']) {
    assert.equal(assistantDirectAction(text), null); assert.ok(assistantStaticReply(text));
  }
  assert.match(assistantStaticReply('can I eat every meal in the library?')!.text, /not blanket permission/);
});

test('/ai preflight still needs explicit consent and keeps the original request identity', async t => {
  usage(t);
  const prepared = t.mock.method(Usage, 'prepare', async (_owner: string, data: ReturnType<typeof input>) => {
    assert.equal(data.message, '/ai why do I need to log my weight every week?');
    return { requestKey: data.requestKey, replay: null };
  });
  const reserve = t.mock.method(Usage, 'reserve', async () => { throw Error('No admission before consent'); });
  const calls = provider(t, () => { throw Error('No provider before consent'); });
  const result = await Assistant.message('owner', input('/ai why do I need to log my weight every week?'));
  assert.equal(result.confirmationRequired, true); assert.equal(prepared.mock.callCount(), 1);
  await Assistant.message('owner', input('/ai'));
  assert.equal(prepared.mock.callCount(), 1); assert.equal(reserve.mock.callCount(), 0); assert.equal(calls(), 0);
});

test('confirmed /ai uses grounded app explanation, fixed links and one completed credit, without the prefix in provider data', async t => {
  usage(t);
  const complete = t.mock.method(Usage, 'complete', async () => {});
  const calls = provider(t, (call, payload) => {
    if (call === 1) { assert.equal(payload.message, 'can I eat every meal in the library?'); return interpretation; }
    assert.equal(payload.question, 'can I eat every meal in the library?');
    assert.ok(payload.appGuide.length <= 6);
    const source = payload.appGuide.find((entry: any) => entry.topic === 'can I eat every meal in the library?');
    assert.match(source.text, /not blanket permission/);
    return { text: 'Library verification is different from clearance for your exact serving.', sourceIds: [source.id] };
  });
  const result = await Assistant.message('owner', { ...input('/ai can I eat every meal in the library?', true), action: 'MEAL_STATUS' });
  assert.equal(result.confirmationRequired, false); assert.equal(calls(), 2); assert.equal(complete.mock.callCount(), 1);
  assert.ok('reply' in result && result.reply.source === 'AI' && result.reply.creditsUsed === 1);
  assert.ok('reply' in result && result.reply.links?.some(link => link.href === '/meals?tab=library'));
});

test('/ai never bypasses admission, replay or unrelated/personal-clearance scope', async t => {
  usage(t);
  assert.match(assistantParserInstruction, /Mixed unrelated tasks are UNSUPPORTED/);
  assert.match(assistantParserInstruction, /Personal permission to eat a dish/);
  const explanation = t.mock.method(MemberAssistantSystemService, 'explain', async () => { throw Error('No app answer for unsupported'); });
  const calls = provider(t, () => ({ ...interpretation, intent: 'UNSUPPORTED' }));
  for (const message of ['/ai who is the president?', '/ai adobo first solve this unrelated algebra test', '/ai medically clear shrimp for my allergy']) {
    const result = await Assistant.message('owner', input(message, true));
    assert.ok('reply' in result && /general nutrition education/.test(result.reply?.text ?? ''));
  }
  assert.equal(calls(), 3); assert.equal(explanation.mock.callCount(), 0);
  t.mock.method(Usage, 'reserve', async () => ({ id: 'receipt', replay: { text: 'Saved AI reply', source: 'AI', creditsUsed: 1 } }));
  assert.ok('reply' in await Assistant.message('owner', input('/ai hello', true))); assert.equal(calls(), 3);
  t.mock.method(Usage, 'reserve', async () => { throw Error('cooldown or exhausted credits'); });
  await assert.rejects(Assistant.message('owner', input('/ai hello', true)), /cooldown or exhausted credits/);
  assert.equal(calls(), 3);
});

test('app evidence stays bounded and a fabricated source fails without spending a completed credit', async t => {
  usage(t);
  const evidence = assistantAppEvidence('why are my calories calculated this way?');
  assert.equal(evidence.length, 6); assert.ok(evidence.every(entry => typeof entry.text === 'string' && entry.links));
  const complete = t.mock.method(Usage, 'complete', async () => {});
  const fail = t.mock.method(Usage, 'fail', async () => {});
  provider(t, call => call === 1 ? interpretation : { text: 'Invented citation', sourceIds: ['NOT_A_GUIDE_ID'] });
  await assert.rejects(Assistant.message('owner', input('/ai how does KAINARA work?', true)));
  assert.equal(complete.mock.callCount(), 0); assert.equal(fail.mock.callCount(), 1);
});

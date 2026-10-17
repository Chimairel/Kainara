import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import {
  naraAnswerSchema,
  matchNaraAnswer,
  naraAnswerKeys,
  naraQuestionAllowed,
} from '../src/domain/nara-answer.policy';
import { NaraAnswerService as Answers } from '../src/services/nara-answer.service';
import { MemberAssistantService as Assistant } from '../src/services/member-assistant.service';
import { MemberAssistantUsageService as Usage } from '../src/services/member-assistant-usage.service';
import { MemberAssistantPlanService as Plan } from '../src/services/member-assistant-plan.service';
import prisma from '../src/lib/prisma';

const example = () =>
  naraAnswerSchema.parse({
    question: 'Why does KAINARA need my weekly weight?',
    variants: ['Bakit kailangan ng KAINARA ang timbang bawat linggo?'],
    answer: 'Recorded weight helps keep your planning information current.',
    category: 'APP_HELP',
  });
const allowance = { tier: 'FREE' as const, cap: 5, used: 5, remaining: 0, resetsAt: '2026-10-18T16:00:00Z' };
const conversation = () =>
  naraAnswerSchema.parse({
    question: 'pasar daw ta bai',
    variants: ['nara, pasar daw ta'],
    answer: 'syur uypchs ✌️ 😭',
    category: 'CONVERSATION',
  });

test('conversation permits exact admin-written social replies without opening arbitrary AI or personal routes', () => {
  const answer = conversation();
  assert.equal(matchNaraAnswer('PASAR daw ta bai?!', [answer]), answer);
  assert.equal(matchNaraAnswer('Nara, pasar daw ta!', [answer]), answer);
  assert.equal(matchNaraAnswer('pasar daw ta bai and write my essay', [answer]), null);
  assert.equal(matchNaraAnswer('/ai pasar daw ta bai', [answer]), null);
  for (const question of [
    'Can I eat taho if I have diabetes?',
    'Today’s nutrition',
    '/ai',
    '/other',
    'What insulin dosage should I take?',
    'Who is the president?',
    '!!!',
  ])
    assert.equal(naraAnswerSchema.safeParse({ ...answer, question, variants: [] }).success, false, question);
  assert.equal(naraAnswerSchema.safeParse({ ...answer, answer: 'Take this insulin dose.' }).success, false);
});

test('wrong-topic and alternative errors identify the actual field and offer a correction', () => {
  const result = naraAnswerSchema.safeParse({ ...example(), variants: ['pasar daw ta bai'] });
  assert(!result.success);
  assert.deepEqual(result.error.issues[0].path, ['variants', 0]);
  assert.match(result.error.issues[0].message, /Alternative question 1.*pasar daw ta bai.*select Nara conversation/u);
});

test('published conversation reader returns social text as a free system reply', async (t) => {
  const answer = conversation();
  const original = prisma.websiteContent.findMany;
  prisma.websiteContent.findMany = (async () => [{ published: answer }]) as unknown as typeof original;
  t.after(() => {
    prisma.websiteContent.findMany = original;
  });
  assert.deepEqual(await Answers.reply(answer.variants[0]), {
    text: answer.answer,
    links: [],
    source: 'SYSTEM',
    creditsUsed: 0,
  });
});

test('instant matching is normalized, exact and multilingual without substring matching', () => {
  const answer = example();
  assert.equal(matchNaraAnswer('WHY does KAINARA need my weekly weight?!', [answer]), answer);
  assert.equal(matchNaraAnswer('Bakit kailangan ng KAINARA ang timbang bawat linggo?', [answer]), answer);
  assert.equal(matchNaraAnswer('Why does KAINARA need my weekly weight and diagnose diabetes?', [answer]), null);
  assert.equal(matchNaraAnswer('/ai ' + answer.question, [answer]), null);
  assert.equal(naraAnswerKeys(answer).length, 2);
});

test('authoring rejects duplicates, unrelated questions, protected routes, medical treatment and oversized content', () => {
  for (const question of [
    'Who is the president?',
    'Can I eat taho if I have diabetes?',
    'Can I eat every meal in the library?',
    'Today’s nutrition',
    '/ai What is protein?',
    'What insulin dosage should I take?',
    'Write code for KAINARA',
  ])
    assert.equal(naraQuestionAllowed(question, 'APP_HELP'), false, question);
  for (const patch of [
    { variants: [example().question.toUpperCase()] },
    { answer: 'x'.repeat(2501) },
    { answer: 'Take this insulin dose.' },
    { owner: 'member' },
    { variants: Array(6).fill('What is KAINARA?') },
  ])
    assert.equal(naraAnswerSchema.safeParse({ ...example(), ...patch }).success, false);
  assert(
    naraAnswerSchema.safeParse({
      ...example(),
      question: 'What is dietary fiber?',
      variants: [],
      category: 'NUTRITION',
    }).success
  );
});

test('published reader withholds drafts, invalid records and administrative metadata', async (t) => {
  const originalQuery = prisma.$queryRaw;
  prisma.$queryRaw = (async () => [{ keys: naraAnswerKeys(example()) }, { keys: null }]) as typeof originalQuery;
  t.after(() => {
    prisma.$queryRaw = originalQuery;
  });
  const original = prisma.websiteContent.findMany;
  prisma.websiteContent.findMany = (async () => [
    { published: example() },
    { published: null },
    { published: { answer: 'broken' } },
  ]) as unknown as typeof original;
  t.after(() => {
    prisma.websiteContent.findMany = original;
  });
  assert.deepEqual(await Answers.questions(), naraAnswerKeys(example()));
  const reply = await Answers.reply(example().question);
  assert.equal(reply?.source, 'SYSTEM');
  assert.equal(reply?.creditsUsed, 0);
  assert(!JSON.stringify(reply).includes('revision'));
});

test('custom answer is free at zero credits and never prepares or reserves AI', async (t) => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Answers, 'reply', async () => ({
    text: example().answer,
    source: 'SYSTEM' as const,
    creditsUsed: 0,
    links: [],
  }));
  t.mock.method(Usage, 'allowance', async () => allowance);
  t.mock.method(Usage, 'prepare', async () => {
    throw new Error('Must not prepare AI');
  });
  t.mock.method(Usage, 'reserve', async () => {
    throw new Error('Must not reserve AI');
  });
  const result = await Assistant.message('member', {
    requestKey: randomUUID(),
    message: example().question,
    allowAi: false,
    context: [],
  });
  assert(!result.confirmationRequired);
  assert.equal(result.reply?.text, example().answer);
  assert.equal(result.allowance.remaining, 0);
});

test('AI command and personal-clearance routes cannot be intercepted by published answers', async (t) => {
  process.env.MEMBER_ASSISTANT_ENABLED = 'true';
  t.mock.method(Answers, 'reply', async () => {
    throw new Error('Must preserve protected route');
  });
  t.mock.method(Usage, 'allowance', async () => allowance);
  t.mock.method(Usage, 'prepare', async (_user: string, input: { requestKey: string }) => ({
    requestKey: input.requestKey,
  }));
  const ai = await Assistant.message('member', {
    requestKey: randomUUID(),
    message: '/ai ' + example().question,
    allowAi: false,
    context: [],
  });
  assert(ai.confirmationRequired);
  t.mock.method(Plan, 'mealStatus', async () => ({
    text: 'Existing saved clearance only.',
    source: 'SYSTEM' as const,
    creditsUsed: 0,
  }));
  const personal = await Assistant.message('member', {
    requestKey: randomUUID(),
    message: 'Can I eat taho if I have diabetes?',
    allowAi: false,
    context: [],
  });
  assert(!personal.confirmationRequired);
  assert.equal(personal.reply?.text, 'Existing saved clearance only.');
});

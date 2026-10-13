import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { supportRequestSchema } from '../src/validation/support.schemas';
import { AppError } from '../src/errors/AppError';

const globals = globalThis as unknown as { prisma: unknown };
const priorPrisma = globals.prisma;
type Stored = { id: string; userId: string; requestKey: string; category: string; replyEmail: string; message: string; deliveryStatus: string };
const saved = new Map<string, Stored>();
const prisma = {
 user: { findUnique: async (_args: unknown): Promise<unknown> => null },
 supportRequest: {
  findUnique: async (args: unknown) => { const key = (args as { where: { userId_requestKey: { userId: string; requestKey: string } } }).where.userId_requestKey; return [...saved.values()].find(item => item.userId === key.userId && item.requestKey === key.requestKey) ?? null; },
  create: async (args: unknown) => { const data = (args as { data: Omit<Stored, 'id' | 'deliveryStatus'> }).data; const item = { ...data, id: crypto.randomUUID(), deliveryStatus: 'PROCESSING' }; saved.set(item.id, item); return item; },
  update: async (args: unknown) => { const { where, data } = args as { where: { id: string }; data: { deliveryStatus: string } }; const item = { ...saved.get(where.id)!, ...data }; saved.set(item.id, item); return item; },
 },
};
globals.prisma = prisma;
after(() => { globals.prisma = priorPrisma; });

const account = { id: 'support-fixture', name: '<Test Member>', email: 'member@example.invalid', role: 'USER', emailVerified: true, isSuspended: false, onboardingDone: false, tosAccepted: false };
const request = { category: 'MEALS' as const, message: 'The recipe card shows <script>bad</script> & a missing photo.\nPlease check it.' };

test('support rejects short, oversized and client-supplied destination/identity fields', () => {
  for (const body of [{ ...request, message: 'short' }, { ...request, message: 'x'.repeat(4001) }, { ...request, category: 'FAKE' }, { ...request, to: 'other@example.invalid' }, { ...request, userId: 'other' }, { ...request, replyEmail: 'bad-address' }, { ...request, requestKey: 'bad-key' }]) {
    assert.equal(supportRequestSchema.safeParse(body).success, false);
  }
  assert.equal(supportRequestSchema.parse({ ...request, message: `  ${request.message}  ` }).message, request.message);
});

test('support emails the fixed operator, stores the request, uses editable reply-to and escapes message without reading health data', async (t) => {
  const { sendSupportRequest, SUPPORT_EMAIL } = await import('../src/services/support.service');
  const previous = { ...process.env }; t.after(() => { process.env = previous; });
  Object.assign(process.env, { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'synthetic', EMAIL_FROM: 'sender@example.invalid' });
  t.mock.method(prisma.user, 'findUnique', async (args: unknown) => {
    assert.deepEqual(args, { where: { id: account.id }, select: { id: true, name: true, email: true, role: true, emailVerified: true } });
    return account;
  });
  let sent = 0;
  t.mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    const mail = JSON.parse(String(init.body)); sent++;
    assert.deepEqual(mail.to, [{ email: SUPPORT_EMAIL }]);
    assert.deepEqual(mail.replyTo, { email: 'alternate@example.invalid' });
    assert.equal(mail.sender.email, 'sender@example.invalid');
    assert.ok(mail.htmlContent.includes('&lt;script&gt;bad&lt;/script&gt; &amp;'));
    assert.ok(mail.htmlContent.includes('&lt;Test Member&gt;'));
    assert.ok(mail.htmlContent.includes('<br/>Please check it.'));
    assert.ok(!mail.htmlContent.includes('<script>'));
    return Response.json({ messageId: 'mock-accepted' }, { status: 201 });
  });
  const input = { ...request, replyEmail: 'alternate@example.invalid', requestKey: crypto.randomUUID() };
  const result = await sendSupportRequest(account.id, input);
  const repeated = await sendSupportRequest(account.id, input); assert.equal(result.reference, repeated.reference);
  assert.equal(result.status, 'RECORDED'); assert.equal(result.deliveryStatus, 'ACCEPTED'); assert.match(result.reference, /^[a-f0-9-]{36}$/); assert.equal(sent, 1);
});

test('missing/unverified accounts cannot send, and provider failure is sanitized without a retry', async (t) => {
  const { sendSupportRequest } = await import('../src/services/support.service');
  const previous = { ...process.env }; t.after(() => { process.env = previous; });
  Object.assign(process.env, { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'synthetic', EMAIL_FROM: 'sender@example.invalid' });
  let current: typeof account | null = null; let sends = 0;
  t.mock.method(prisma.user, 'findUnique', async () => current);
  t.mock.method(globalThis, 'fetch', async () => { sends++; throw new Error('private transport secret'); });
  await assert.rejects(sendSupportRequest(account.id, request), (err) => err instanceof AppError && err.statusCode === 401);
  current = { ...account, emailVerified: false };
  await assert.rejects(sendSupportRequest(account.id, request), (err) => err instanceof AppError && err.statusCode === 403);
  assert.equal(sends, 0); current = account;
  const receipt = await sendSupportRequest(account.id, request);
  assert.equal(receipt.status, 'RECORDED'); assert.equal(receipt.deliveryStatus, 'UNCONFIRMED');
  assert.ok(saved.has(receipt.reference));
  assert.equal(sends, 1);
});

test('HTTP support requires a verified session, allows unfinished onboarding and limits each account', async (t) => {
  process.env.JWT_SECRET ||= 'test-only-support-access'; process.env.JWT_REFRESH_SECRET ||= 'test-only-support-refresh';

  const previous = { ...process.env }; t.after(() => { process.env = previous; });
  Object.assign(process.env, { EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'synthetic', EMAIL_FROM: 'sender@example.invalid' });
  const { default: support } = await import('../src/routes/support.routes');
  const { signAccessToken } = await import('../src/lib/jwt');
  t.mock.method(prisma.user, 'findUnique', async (args: unknown) => { const { where } = args as { where: { id: string } }; return { ...account, id: where.id, emailVerified: where.id !== 'unverified' }; });
  const realFetch = globalThis.fetch; let sent = 0;
  t.mock.method(globalThis, 'fetch', async (url: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (String(url).startsWith('http://127.0.0.1:')) return realFetch(url, init);
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email'); sent++;
    return Response.json({ messageId: 'mock-accepted' }, { status: 201 });
  });
  const app = express(); app.use(express.json()); app.use('/api/support', support);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/support/requests`;
  const send = (id?: string) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(id ? { Authorization: `Bearer ${signAccessToken({ userId: id, email: account.email, role: 'USER' })}` } : {}) }, body: JSON.stringify(request) });
  assert.equal((await send()).status, 401); assert.equal((await send('unverified')).status, 403);
  for (let i = 0; i < 5; i++) assert.equal((await send(account.id)).status, 202);
  assert.equal((await send(account.id)).status, 429);
  assert.equal((await send('another-account')).status, 202); assert.equal(sent, 6);
});

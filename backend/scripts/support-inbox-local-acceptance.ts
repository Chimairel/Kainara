/** Fresh synthetic database on the owned loopback container; never reads backend/.env. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { parse } from 'dotenv';

async function main() {
  const root = resolve(__dirname, '../..');
  const container = 'kainara-local-postgres';
  const docker = (args: string[], input?: string) => execFileSync('docker', args, { encoding: 'utf8', input, maxBuffer: 32 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
  const inspected = JSON.parse(docker(['inspect', container]))[0];
  assert.equal(inspected.Config.Labels['com.docker.compose.project'], 'kainara-local-development');
  assert.deepEqual(inspected.HostConfig.PortBindings['5432/tcp'], [{ HostIp: '127.0.0.1', HostPort: '55432' }]);
  const database = `kainara_support_20261013_${randomBytes(4).toString('hex')}`;
  assert.match(database, /^kainara_support_20261013_[a-f0-9]{8}$/);
  const password = parse(readFileSync(resolve(root, 'backend/.local/local-development/postgres.env'))).LOCAL_POSTGRES_PASSWORD;
  assert.match(password, /^[a-f0-9]{64}$/);
  const url = `postgresql://postgres:${password}@127.0.0.1:55432/${database}?schema=public`;
  Object.assign(process.env, { DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test', JWT_SECRET: 'synthetic-support-access-only', JWT_REFRESH_SECRET: 'synthetic-support-refresh-only', EMAIL_PROVIDER: 'brevo', BREVO_API_KEY: 'synthetic', EMAIL_FROM: 'sender@example.invalid', SMTP_USER: '', SMTP_PASS: '', GEMINI_API_KEY: '', CLINICAL_CLARIFICATIONS_ENABLED: 'false' });
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  mkdirSync(resolve(root, 'backend/.local/docs-support'), { recursive: true });
  writeFileSync(resolve(root, 'backend/.local/support-before.prisma'), execFileSync('git', ['show', '285ce697:backend/prisma/schema.prisma'], { cwd: root, encoding: 'utf8' }));
  // Apply the previous committed schema followed by the exact additive migration.
  const ddl = execFileSync(process.execPath, [resolve(root, 'backend/node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', resolve(root, 'backend/.local/support-before.prisma'), '--script'], { encoding: 'utf8', cwd: resolve(root, 'backend'), env: process.env, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], ddl);
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], readFileSync(resolve(root, 'backend/prisma/migrations/20261013095000_support_inbox/migration.sql'), 'utf8'));
  const { default: db } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { sendSupportRequest, replyToSupportRequest } = await import('../src/services/support.service');
  const nativeFetch = globalThis.fetch;
  const emails: Record<string, any>[] = [];
  let failMail = false;
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith('http://127.0.0.1:')) return nativeFetch(input, init);
    assert.equal(String(input), 'https://api.brevo.com/v3/smtp/email');
    const email = JSON.parse(String(init?.body)); emails.push(email);
    assert.equal(email.sender.email, 'sender@example.invalid');
    if (failMail) throw new Error('Synthetic provider timeout');
    return Response.json({ messageId: 'synthetic-accepted' }, { status: 201 });
  };
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const actor = (role: 'ADMIN' | 'USER' | 'NUTRITIONIST', emailVerified = true) => db.user.create({ data: { name: `Synthetic ${role}`, email: `${randomUUID()}@example.invalid`, passwordHash: 'NON_LOGIN_FIXTURE', role, emailVerified } });
  const member = await actor('USER'), admin = await actor('ADMIN'), rnd = await actor('NUTRITIONIST'), unverified = await actor('USER', false);
  const call = async (user: typeof member | null, path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(user ? { Authorization: `Bearer ${signAccessToken({ userId: user.id, email: user.email, role: user.role })}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as any };
  };
  const checks: string[] = []; const pass = (name: string) => { checks.push(name); console.log(`PASS ${name}`); };
  try {
    const input = { category: 'MEALS' as const, replyEmail: 'Exact.Reply@example.invalid', message: 'The grocery list did not update after clicking. <script>bad</script>', requestKey: randomUUID() };
    assert.equal((await call(null, '/support/requests', 'POST', input)).status, 401);
    assert.equal((await call(unverified, '/support/requests', 'POST', input)).status, 403);
    const created = await call(member, '/support/requests', 'POST', input);
    assert.equal(created.status, 202); assert.equal(created.body.data.status, 'RECORDED');
    const id = created.body.data.reference;
    assert.equal((await db.supportRequest.findUniqueOrThrow({ where: { id } })).replyEmail, input.replyEmail);
    assert.deepEqual(emails[0].to, [{ email: 'chimairelp@gmail.com' }]);
    assert.deepEqual(emails[0].replyTo, { email: input.replyEmail });
    assert.ok(emails[0].htmlContent.includes('&lt;script&gt;bad&lt;/script&gt;'));
    pass('Verified unfinished-onboarding member can submit; exact editable reply address and escaped content are saved');
    const repeat = await call(member, '/support/requests', 'POST', input); assert.equal(repeat.body.data.reference, id); assert.equal(emails.length, 1);
    assert.equal((await call(member, '/support/requests', 'POST', { ...input, message: 'A different message that must not reuse the key.' })).status, 409);
    pass('Member retries are idempotent; reusing a reference with changed content is rejected');
    for (const user of [null, member, rnd]) assert.equal((await call(user, '/admin/support')).status, user ? 403 : 401);
    assert.equal((await call(admin, '/admin/support?page=-1')).status, 400);
    assert.equal((await call(admin, '/admin/support/not-an-id')).status, 400);
    const list = await call(admin, '/admin/support'); assert.equal(list.status, 200); assert.equal(list.body.data.total, 1); assert.equal(list.body.data.items[0].message, undefined);
    const detail = await call(admin, `/admin/support/${id}`); assert.equal(detail.body.data.message, input.message);
    pass('Admin-only bounded list and full detail work; member/RND/anonymous access and invalid queries are rejected');
    const reply = { message: 'Thanks for reporting this. We checked the checklist. <b>Fixed</b>', requestKey: randomUUID() };
    const replied = await call(admin, `/admin/support/${id}/replies`, 'POST', reply); assert.equal(replied.status, 202); assert.equal(replied.body.data.deliveryStatus, 'ACCEPTED');
    assert.deepEqual(emails[1].to, [{ email: input.replyEmail }]); assert.deepEqual(emails[1].replyTo, { email: 'chimairelp@gmail.com' });
    assert.ok(emails[1].htmlContent.includes('&lt;b&gt;Fixed&lt;/b&gt;'));
    await call(admin, `/admin/support/${id}/replies`, 'POST', reply); assert.equal(emails.length, 2); assert.equal(await db.supportReply.count(), 1);
    const concurrencyKey = randomUUID();
    const parallel = await Promise.all([replyToSupportRequest(admin.id, id, { ...reply, requestKey: concurrencyKey }), replyToSupportRequest(admin.id, id, { ...reply, requestKey: concurrencyKey })]);
    assert.equal(parallel[0].id, parallel[1].id); assert.equal(emails.length, 3);
    pass('Admin reply uses configured sender and chosen recipient; HTTP retries and concurrent duplicate replies send once');
    failMail = true;
    const failedInput = { ...input, requestKey: randomUUID() };
    const recorded = await call(member, '/support/requests', 'POST', failedInput); assert.equal(recorded.status, 202); assert.equal(recorded.body.data.deliveryStatus, 'UNCONFIRMED');
    const failedReply = { ...reply, requestKey: randomUUID() };
    const saved = await call(admin, `/admin/support/${id}/replies`, 'POST', failedReply); assert.equal(saved.body.data.deliveryStatus, 'UNCONFIRMED');
    const before = emails.length; await call(admin, `/admin/support/${id}/replies`, 'POST', failedReply); assert.equal(emails.length, before);
    pass('Provider timeout preserves request/reply with unconfirmed status and never automatically resends');
    await db.user.delete({ where: { id: admin.id } });
    assert.equal((await db.supportReply.findFirstOrThrow()).authorId, null);
    await db.user.delete({ where: { id: member.id } }); assert.equal(await db.supportRequest.count(), 0); assert.equal(await db.supportReply.count(), 0);
    pass('Deleted admin attribution becomes nullable; deleting member cascades their support conversations');
    writeFileSync(resolve(root, 'backend/.local/docs-support/inbox-acceptance.json'), JSON.stringify({ target: `${database}@127.0.0.1:55432`, time: new Date().toISOString(), checks, email: 'Mocked provider only; no external deliveries' }, null, 2));
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); await db.$disconnect(); globalThis.fetch = nativeFetch; }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error : 'Local support acceptance failed; inspect the local fixture.'); process.exitCode = 1; });

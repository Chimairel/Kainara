/** Actual HTTP/SQL session checks; only a fresh task-owned loopback database is allowed. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import bcrypt from 'bcryptjs';
import express from 'express';
import cookieParser from 'cookie-parser';
import { PrismaClient } from '@prisma/client';
import prisma from '../src/lib/prisma';
import authRouter from '../src/routes/auth.routes';
import { createRefreshSession, hashSessionToken } from '../src/services/auth/sessions';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55484');
  assert.equal(target.pathname, '/kainara_auth_session');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(await prisma.user.count(), 0, 'Use a fresh task-owned database.');
  const blocker = new PrismaClient();
  const app = express();
  app.use(express.json(), cookieParser());
  app.use('/api/auth', authRouter);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/auth`;
  const password = 'Synthetic-session-only-123';
  const passwordHash = await bcrypt.hash(password, 4);
  const user = await prisma.user.create({
    data: {
      name: 'Synthetic Session Fixture',
      email: 'session-fixture@example.invalid',
      passwordHash,
      emailVerified: true,
      role: 'NUTRITIONIST',
    },
  });
  const payload = { userId: user.id, email: user.email, role: user.role };
  const post = async (path: string, body: unknown, cookie?: string) => {
    const response = await fetch(base + path, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });
    return {
      status: response.status,
      cookie: response.headers.get('set-cookie'),
      body: (await response.json()) as { error?: string; data?: { accessToken?: string } },
    };
  };
  // Hold real rows for >5s; unlike mocked timing this exercises Prisma's transaction lifetime.
  const withHeldRow = async <T>(table: 'User' | 'Session', id: string, run: () => Promise<T>) => {
    let acquired!: () => void;
    const ready = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const held = blocker.$transaction(
      async (tx) => {
        if (table === 'User') await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR UPDATE`;
        else await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${id} FOR UPDATE`;
        acquired();
        await tx.$queryRaw`SELECT 1 FROM pg_sleep(6)`;
      },
      { timeout: 15_000 }
    );
    await ready;
    const result = await Promise.allSettled([run(), held]);
    if (result[1].status === 'rejected') throw result[1].reason;
    if (result[0].status === 'rejected') throw result[0].reason;
    return result[0].value;
  };
  try {
    await assert.rejects(
      blocker.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_sleep(6)`;
        await tx.$queryRaw`SELECT 1`;
      }),
      (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === 'P2028'
    );
    console.log('PASS: reproduced the default 5-second transaction expiry.');
    const login = await withHeldRow('User', user.id, () => post('/login', { email: user.email, password }));
    assert.equal(login.status, 200);
    assert.ok(login.body.data?.accessToken);
    assert.match(login.cookie ?? '', /HttpOnly/);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1);
    const cookie = login.cookie!.split(';')[0];
    const session = await prisma.session.findFirstOrThrow({ where: { userId: user.id } });
    const refreshed = await withHeldRow('Session', session.id, () => post('/refresh', {}, cookie));
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.data?.accessToken);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1);
    assert.equal(await prisma.session.count({ where: { id: session.id } }), 0);
    assert.equal((await post('/refresh', {}, cookie)).status, 401);
    console.log('PASS: slow login/refresh commit once, rotate the cookie and reject replay.');
    const nextCookie = refreshed.cookie!.split(';')[0];
    const concurrent = await Promise.all([post('/refresh', {}, nextCookie), post('/refresh', {}, nextCookie)]);
    assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 401]);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), 1);
    assert.equal((await post('/login', { email: user.email, password: 'Wrong-synthetic-password' })).status, 400);
    // A concurrent credential update commits before the waiting creator reads the locked account.
    let acquired!: () => void;
    let release!: () => void;
    const ready = new Promise<void>((resolve) => {
      acquired = resolve;
    });
    const allowCommit = new Promise<void>((resolve) => {
      release = resolve;
    });
    const changed = blocker.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
        acquired();
        await allowCommit;
        await tx.user.update({ where: { id: user.id }, data: { passwordHash: 'changed-synthetic-hash' } });
      },
      { timeout: 15_000 }
    );
    await ready;
    const before = await prisma.session.count({ where: { userId: user.id } });
    const stale = assert.rejects(createRefreshSession(user.id, payload, passwordHash), /credentials changed/);
    release();
    await Promise.all([stale, changed]);
    assert.equal(await prisma.session.count({ where: { userId: user.id } }), before);
    for (const state of [
      { isSuspended: true, passwordLoginEnabled: true },
      { isSuspended: false, passwordLoginEnabled: false },
    ]) {
      await prisma.user.update({ where: { id: user.id }, data: { ...state, passwordHash } });
      await assert.rejects(createRefreshSession(user.id, payload, passwordHash), /credentials changed/);
      assert.equal(await prisma.session.count({ where: { userId: user.id } }), before);
    }
    const token = concurrent
      .find((response) => response.status === 200)!
      .cookie!.split(';')[0]
      .split('=')[1];
    assert.equal(
      await prisma.session.count({ where: { sessionToken: hashSessionToken(decodeURIComponent(token)) } }),
      1
    );
    console.log('PASS: concurrency, password changes, suspension and disabled password access retain their gates.');
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await blocker.$disconnect();
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error('Auth session acceptance failed; no credentials or raw database diagnostics are printed.');
  process.exitCode = 1;
});

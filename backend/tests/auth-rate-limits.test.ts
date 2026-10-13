import assert from 'node:assert/strict';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { attemptLimiter, emailAttemptKey } from '../src/middleware/attemptLimiter';
import { accountCreationLimiter, apiLimiter, loginLimiter } from '../src/middleware/rateLimiter';

test('failed sign-ins are limited independently of registration and browsing', async () => {
  const app = express();
  app.use(express.json());
  app.post('/api/auth/login', loginLimiter, (req, res) => res.sendStatus(req.body.valid ? 200 : 400));
  app.post('/api/auth/register', accountCreationLimiter, (_req, res) => res.sendStatus(200));
  app.use('/api', apiLimiter);
  app.get('/api/browse', (_req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const { port } = server.address() as AddressInfo;
    const base = `http://127.0.0.1:${port}/api`;
    const login = (valid: boolean) =>
      fetch(`${base}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ valid }),
      });
    assert.equal((await fetch(`${base}/browse`)).status, 200);
    assert.equal((await login(true)).status, 200);
    const failedAllowance = 20;
    for (let attempt = 0; attempt < failedAllowance; attempt += 1) {
      assert.equal((await login(false)).status, 400);
    }
    const blocked = await login(false);
    assert.equal(blocked.status, 429);
    const body = await blocked.json() as { error: string; retryAfterSeconds: number };
    assert.match(body.error, /failed sign-in attempts/i);
    assert.ok(body.retryAfterSeconds > 0 && body.retryAfterSeconds <= 900);
    assert.equal(blocked.headers.get('retry-after'), String(body.retryAfterSeconds));
    assert.equal((await fetch(`${base}/auth/register`, { method: 'POST' })).status, 200);
    assert.equal((await fetch(`${base}/browse`)).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});


test('email budgets normalize casing, remain independent, count invalid attempts and expire', async () => {
  const app = express(); app.use(express.json());
  app.post('/attempt', attemptLimiter(2, 0.002, 'Wait.', emailAttemptKey), (_req, res) => res.sendStatus(400));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  const send = (email: string) => fetch(`http://127.0.0.1:${port}/attempt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
  try {
    assert.equal(emailAttemptKey({ body: { email: ' A@B.com ' } } as express.Request), emailAttemptKey({ body: { email: 'a@b.com' } } as express.Request));
    assert.ok(!emailAttemptKey({ body: { email: 'a@b.com' } } as express.Request).includes('a@b.com'));
    assert.equal((await send('A@example.invalid')).status, 400);
    assert.equal((await send(' a@example.invalid ')).status, 400);
    assert.equal((await send('a@example.invalid')).status, 429);
    assert.equal((await send('b@example.invalid')).status, 400);
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal((await send('a@example.invalid')).status, 400);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

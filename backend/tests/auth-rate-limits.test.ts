import assert from 'node:assert/strict';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
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
    const failedAllowance = process.env.NODE_ENV === 'development' ? 500 : 20;
    for (let attempt = 0; attempt < failedAllowance; attempt += 1) {
      assert.equal((await login(false)).status, 400);
    }
    const blocked = await login(false);
    assert.equal(blocked.status, 429);
    assert.match(((await blocked.json()) as { error: string }).error, /failed sign-in attempts/i);
    assert.equal((await fetch(`${base}/auth/register`, { method: 'POST' })).status, 200);
    assert.equal((await fetch(`${base}/browse`)).status, 200);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

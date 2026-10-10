import assert from 'node:assert/strict';
import { once } from 'node:events';
import { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { geminiLimiter } from '../src/middleware/rateLimiter';

test('AI allowances separate signed colleagues on one IP; forged tokens share the anonymous limit', async (context) => {
  const secret = 'synthetic-test-secret-not-a-deployed-key';
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = secret;
  context.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  const app = express();
  app.post('/generate', geminiLimiter, (_req, res) => res.sendStatus(200));
  const server = app.listen(0, '127.0.0.1');
  try {
    await once(server, 'listening');
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/generate`;
    const request = (token: string) => fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    const first = jwt.sign({ userId: 'synthetic-rnd-one' }, secret, { expiresIn: '5m' });
    const second = jwt.sign({ userId: 'synthetic-rnd-two' }, secret, { expiresIn: '5m' });
    for (let i = 0; i < 5; i++) assert.equal((await request(first)).status, 200);
    assert.equal((await request(first)).status, 429);
    for (let i = 0; i < 5; i++) assert.equal((await request(second)).status, 200);
    assert.equal((await request(second)).status, 429);
    for (let i = 0; i < 5; i++) {
      const forged = jwt.sign({ userId: `forged-${i}` }, 'wrong-key');
      assert.equal((await request(forged)).status, 200);
    }
    assert.equal((await request(jwt.sign({ userId: 'forged-again' }, 'wrong-key'))).status, 429);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

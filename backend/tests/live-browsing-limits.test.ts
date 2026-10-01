import assert from 'node:assert/strict';
import test from 'node:test';
import jwt from 'jsonwebtoken';
import { apiBrowsingKey } from '../src/middleware/rateLimiter';

test('live browsing separates signed accounts on one connection but untrusted tokens keep the IP budget', () => {
  const previous = process.env.JWT_SECRET;
  const secret = 'synthetic-live-browsing-key';
  process.env.JWT_SECRET = secret;
  const key = (token?: string) =>
    apiBrowsingKey({ ip: '192.0.2.10', headers: token ? { authorization: `Bearer ${token}` } : {} });
  try {
    const first = jwt.sign({ userId: 'fixture-first' }, secret, { expiresIn: '15m' });
    const second = jwt.sign({ userId: 'fixture-second' }, secret, { expiresIn: '15m' });
    assert.equal(key(first), 'account:fixture-first');
    assert.equal(key(second), 'account:fixture-second');
    assert.equal(
      key(jwt.sign({ userId: 'fixture-first' }, secret, { expiresIn: '15m', jwtid: 'replacement' })),
      key(first),
      'Token rotation must not reset the account budget.'
    );
    assert.equal(key(jwt.sign({ userId: 'forged' }, 'wrong-secret')), key());
    assert.equal(key(jwt.sign({ userId: 'expired' }, secret, { expiresIn: -1 })), key());
    assert.equal(key('unsigned.invalid'), key());
    assert.equal(key(jwt.sign({ sub: 'unrelated' }, secret)), key());
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});

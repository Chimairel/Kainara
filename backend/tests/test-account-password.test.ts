import assert from 'node:assert/strict';
import test from 'node:test';
import { sharedTestAccountPassword, validateTestAccountPassword } from '../src/services/dev-test-accounts/password';

const env = { NODE_ENV: 'development', JWT_SECRET: 'disposable-fixture-signing-key' };
test('new synthetic batches and roles share a stable server credential', () => {
  const first = sharedTestAccountPassword(env);
  assert.equal(sharedTestAccountPassword({ ...env }), first);
  assert.equal(sharedTestAccountPassword({ ...env, NODE_ENV: 'test' }), first);
  assert.notEqual(first, env.JWT_SECRET);
  assert.ok(first.length >= 16 && Buffer.byteLength(first, 'utf8') <= 72);
  assert.notEqual(sharedTestAccountPassword({ ...env, JWT_SECRET: 'different-fixture-key' }), first);
});
test('an explicit server credential is shared by admin UI and CLI policy', () => {
  const configured = 'local-fixture-password-only';
  assert.equal(sharedTestAccountPassword({ ...env, DEV_TEST_ACCOUNT_PASSWORD: configured }), configured);
  assert.equal(sharedTestAccountPassword({ NODE_ENV: 'test', DEV_TEST_ACCOUNT_PASSWORD: configured }), configured);
});
test('missing or invalid credentials fail rather than creating random per-batch passwords', () => {
  for (const patch of [
    { JWT_SECRET: '' },
    { DEV_TEST_ACCOUNT_PASSWORD: '' },
    { DEV_TEST_ACCOUNT_PASSWORD: 'short' },
    { DEV_TEST_ACCOUNT_PASSWORD: 'x'.repeat(7) },
    { DEV_TEST_ACCOUNT_PASSWORD: 'x'.repeat(73) },
    { DEV_TEST_ACCOUNT_PASSWORD: '界'.repeat(25) },
  ])
    assert.throws(() => sharedTestAccountPassword({ ...env, ...patch }));
});

test('synthetic credentials accept eight-character passwords with the same writer validation', () => {
  const configured = 'Test1234';
  assert.equal(sharedTestAccountPassword({ ...env, DEV_TEST_ACCOUNT_PASSWORD: configured }), configured);
  assert.doesNotThrow(() => validateTestAccountPassword(configured));
  assert.throws(() => validateTestAccountPassword('x'.repeat(7)));
  assert.throws(() => validateTestAccountPassword('界'.repeat(25)));
});
test('shared synthetic credentials cannot be resolved in production or demo runtime', () => {
  for (const patch of [{ NODE_ENV: '' }, { NODE_ENV: 'production' }, { NUTRIMIND_DEPLOYMENT_MODE: 'capstone-demo' }])
    assert.throws(() => sharedTestAccountPassword({ ...env, ...patch }));
});

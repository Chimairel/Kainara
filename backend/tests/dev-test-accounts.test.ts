import assert from 'node:assert/strict';
import test from 'node:test';
import {
  accountSpecSchema,
  assertWriteTarget,
  databaseTarget,
  defaultAccountSpecs,
  fixtureIdentity,
} from '../scripts/helpers/dev-test-account-config';
import { inspectAccounts } from '../scripts/helpers/dev-test-account-writer';

test('development accounts use reserved emails, marked names and all three internal roles', () => {
  const identities = defaultAccountSpecs.map((spec) => fixtureIdentity('qa', spec));
  assert.equal(identities.length, 10);
  assert.deepEqual(new Set(identities.map((item) => item.role)), new Set(['ADMIN', 'USER', 'NUTRITIONIST']));
  assert.ok(identities.every((item) => item.email.endsWith('@example.test') && item.name.startsWith('[TEST qa]')));
  assert.throws(() => fixtureIdentity('../escape', defaultAccountSpecs[0]));
});
test('target tokens hide credentials, remain stable across credentials and distinguish databases', () => {
  const a = databaseTarget('postgresql://owner:secret@localhost:5432/dev', { NODE_ENV: 'development' });
  const b = databaseTarget('postgresql://other:different@localhost:5432/dev?sslmode=require', {
    NODE_ENV: 'development',
  });
  assert.equal(a.token, b.token);
  assert.ok(!a.label.includes('secret') && !a.label.includes('owner'));
  assert.notEqual(a.token, databaseTarget('postgresql://localhost/other', { NODE_ENV: 'development' }).token);
});
test('production-like runtimes and targets cannot enable test credential provisioning', () => {
  for (const env of [
    {},
    { NODE_ENV: 'production' },
    { NODE_ENV: 'development', VERCEL_ENV: 'production' },
    { NODE_ENV: 'development', RAILWAY_ENVIRONMENT_NAME: 'demo' },
  ])
    assert.throws(() => databaseTarget('postgresql://localhost/dev', env));
  for (const url of ['postgresql://localhost/production', 'postgresql://prod.example/dev', 'https://localhost/dev'])
    assert.throws(() => databaseTarget(url, { NODE_ENV: 'development' }));
});
test('all writes require an exact confirmed target; remote development requires a separate authorization flag', () => {
  const local = databaseTarget('postgresql://localhost/dev', { NODE_ENV: 'test' });
  assert.throws(() => assertWriteTarget(local, ['--apply']));
  assert.throws(() => assertWriteTarget(local, ['--apply', '--confirm-target', 'wrong']));
  assertWriteTarget(local, ['--apply', '--confirm-target', local.token]);
  const remote = databaseTarget('postgresql://dev.example/dev', { NODE_ENV: 'development' });
  assert.throws(() => assertWriteTarget(remote, ['--confirm-target', remote.token]));
  assertWriteTarget(remote, ['--confirm-target', remote.token, '--allow-shared-development']);
});
test('custom account specifications reject collisions, mismatched roles and malformed safety declarations', () => {
  assert.throws(() => accountSpecSchema.parse([defaultAccountSpecs[0], defaultAccountSpecs[0]]));
  assert.throws(() => accountSpecSchema.parse([{ alias: 'member', name: 'Test', role: 'USER', rnd: {} }]));
  assert.throws(() =>
    accountSpecSchema.parse([
      { alias: 'member', name: 'Test', role: 'USER', member: { conditions: ['NONE', 'DIABETES'] } },
    ])
  );
  assert.throws(() =>
    accountSpecSchema.parse([{ alias: 'rnd', name: 'Test', role: 'RND', rnd: { experienceYears: -1 } }])
  );
  assert.throws(() => accountSpecSchema.parse([{ ...defaultAccountSpecs[0], password: 'must-not-be-in-spec' }]));
});
test('dry inspection refuses existing accounts with a conflicting identity and never issues a mutation', async () => {
  const identity = fixtureIdentity('qa', defaultAccountSpecs[0]);
  const fake = { user: { findMany: async () => [{ ...identity, id: 'actual-owner' }] } };
  await assert.rejects(
    inspectAccounts(fake as Parameters<typeof inspectAccounts>[0], 'qa', [defaultAccountSpecs[0]]),
    /collision/
  );
  fake.user.findMany = async () => [identity];
  assert.equal(
    (await inspectAccounts(fake as Parameters<typeof inspectAccounts>[0], 'qa', [defaultAccountSpecs[0]]))[0].exists,
    true
  );
});

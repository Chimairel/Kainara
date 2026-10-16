import assert from 'node:assert/strict';
import test from 'node:test';
import { seedTarget, seedDisposition, SEED_RATIONALE } from './seed-capstone-recipe-reviews.mjs';

test('capstone fixtures reject public or clinically approved environments', () => {
  const source = { DATABASE_URL: 'postgresql://test:test@127.0.0.1/test', NUTRIMIND_DEPLOYMENT_MODE: 'capstone-demo' };
  assert.match(seedTarget(source).token, /^[a-f0-9]{20}$/);
  assert.throws(() => seedTarget({ ...source, NUTRIMIND_DEPLOYMENT_MODE: 'public' }));
  assert.throws(() => seedTarget({ ...source, CLINICAL_POLICY_APPROVED_VERSION: 'approved' }));
  assert.throws(() => seedTarget({ ...source, DATABASE_URL: 'postgresql://test:test@example.test/test' }));
});

test('target confirmation binds database and excludes credentials from its label', () => {
  const source = {
    DATABASE_URL: 'postgresql://test:private@127.0.0.1/first',
    NUTRIMIND_DEPLOYMENT_MODE: 'capstone-demo',
  };
  assert(!seedTarget(source).label.includes('private'));
  assert.notEqual(
    seedTarget(source).token,
    seedTarget({ ...source, DATABASE_URL: source.DATABASE_URL.replace('first', 'second') }).token
  );
});

test('seeding preserves real verification, rejection and active claims', () => {
  const now = new Date();
  assert.equal(seedDisposition(null), 'insert');
  assert.equal(seedDisposition({ status: 'VERIFIED' }), 'preserve-verified');
  assert.equal(seedDisposition({ status: 'REJECTED' }), 'preserve-rejected');
  assert.equal(
    seedDisposition({ status: 'PENDING', claimedByNutritionistId: 'other', claimedAt: now }, now),
    'preserve-claim'
  );
  assert.equal(
    seedDisposition(
      { status: 'PENDING', claimedByNutritionistId: 'other', claimedAt: new Date(now - 31 * 60000) },
      now
    ),
    'update'
  );
  assert.equal(seedDisposition({ status: 'PENDING' }), 'update');
  assert.match(SEED_RATIONALE, /SIMULATION/);
  assert.match(SEED_RATIONALE, /No individual professional review/);
});

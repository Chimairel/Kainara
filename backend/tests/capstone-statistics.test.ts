import assert from 'node:assert/strict';
import test from 'node:test';
import { distribution, percentage } from '../scripts/helpers/capstone-statistics';

test('evaluation statistics retain zero, exclude invalid elapsed samples and never invent empty rates', () => {
  assert.deepEqual(distribution([NaN, -2, Infinity]), { samples: 0, p50Ms: null, p95Ms: null, maxMs: null });
  assert.deepEqual(distribution([100, 0, 200, 300]), { samples: 4, p50Ms: 100, p95Ms: 300, maxMs: 300 });
  assert.equal(percentage(0, 0), null);
  assert.equal(percentage(0, 10), 0);
  assert.equal(percentage(1, 3), 33.33);
});

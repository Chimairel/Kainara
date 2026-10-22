import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { sleepingNara } from '../assets/sleeping-nara.ts';

test('the actual Metro/Jest glob consumer resolves the existing bounded braces implementation', () => {
  const require = createRequire(import.meta.url);
  const consumer = createRequire(require.resolve('micromatch'));
  const braces = consumer('braces');
  assert.deepEqual(braces.expand('meal-{one,two}'), ['meal-one', 'meal-two']);
  assert.throws(() => braces.parse('{'.repeat(1000) + 'meal' + '}'.repeat(1000)), /nesting depth/);
});
test('the native Nara asset is decoded XML rather than UTF-16 bytes in a JavaScript string', () => {
  assert.ok(sleepingNara.includes('<svg'));
  assert.ok(!sleepingNara.includes('\0'));
  assert.ok(!sleepingNara.includes('\uFFFD'));
});

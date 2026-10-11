import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogueMatchingCache, invalidateCatalogueMatching } from '../src/lib/catalogue-matching-cache';

test('matching cache deduplicates concurrent catalogue loads and invalidates after writes', async () => {
  let calls = 0;
  const read = catalogueMatchingCache(
    async () => {
      calls++;
      return ['food'];
    },
    (rows) => rows.length > 0
  );
  await Promise.all([read(), read(), read()]);
  assert.equal(calls, 1);
  await read();
  assert.equal(calls, 1);
  invalidateCatalogueMatching();
  await read();
  assert.equal(calls, 2);
});

test('a pre-invalidation load cannot populate the next catalogue generation', async () => {
  let release!: (rows: string[]) => void;
  let calls = 0;
  const read = catalogueMatchingCache(
    () => {
      calls++;
      return calls === 1
        ? new Promise<string[]>((resolve) => {
            release = resolve;
          })
        : Promise.resolve(['new']);
    },
    (rows) => rows.length > 0
  );
  const old = read();
  invalidateCatalogueMatching();
  assert.deepEqual(await read(), ['new']);
  release(['old']);
  await old;
  assert.deepEqual(await read(), ['new']);
  assert.equal(calls, 2);
});

test('empty and failed catalogue loads never hide later imports', async () => {
  let calls = 0;
  const read = catalogueMatchingCache(
    async () => {
      calls++;
      if (calls === 1) throw new Error('temporary');
      return calls === 2 ? [] : ['imported'];
    },
    (rows) => rows.length > 0
  );
  await assert.rejects(read());
  assert.deepEqual(await read(), []);
  assert.deepEqual(await read(), ['imported']);
  assert.equal(calls, 3);
});

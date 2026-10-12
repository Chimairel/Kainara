import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient, Prisma } from '@prisma/client';
import { searchRecipeFoods } from '../src/services/recipe-food-search.service';

test('an exact food is retained ahead of broad mixed-source matches within the result limit', async () => {
  const queries: Prisma.FoodItemFindManyArgs[] = [];
  const db = {
    foodItem: {
      findMany: async (args: Prisma.FoodItemFindManyArgs) => {
        queries.push(args);
        return queries.length === 1
          ? [{ id: 'carrot-fnri', name: 'Carrot' }]
          : Array.from({ length: 19 }, (_, i) => ({ id: `baby-${i}`, name: `Babyfood carrot ${i}` }));
      },
    },
  } as unknown as Pick<PrismaClient, 'foodItem'>;
  const results = await searchRecipeFoods(' Carrot ', db);
  assert.equal(results.length, 20);
  assert.equal(results[0].id, 'carrot-fnri');
  assert.deepEqual(queries[0].where?.name, { equals: 'Carrot', mode: 'insensitive' });
  assert.deepEqual(queries[1].where?.id, { notIn: ['carrot-fnri'] });
  assert.equal(queries[1].take, 19);
  assert.deepEqual(Object.keys(queries[0].select ?? {}).sort(), [
    'calories',
    'carbsG',
    'fatG',
    'id',
    'name',
    'proteinG',
    'source',
  ]);
  assert.deepEqual(await searchRecipeFoods('x', db), []);
  assert.equal(queries.length, 2);
});

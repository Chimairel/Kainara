import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { loadMealReviewContext } from '../../src/services/meal-case-context.service';
import { preserveRelationQueryStrategy } from '../../src/lib/relation-query-strategy';

/** Real SQL parity/budget check against the acceptance runner's owned loopback database. */
export async function checkReviewContextQueries(mealId: string) {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(process.env.NODE_ENV, 'test');
  const base = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
  let queries = 0;
  base.$on('query', () => queries++);
  const legacy = base.$extends({ query: { $allModels: {
    $allOperations({ args, operation, query }) {
      return query(preserveRelationQueryStrategy(operation, { ...args, relationLoadStrategy: 'query' }));
    },
  } } });
  try {
    const previous = await loadMealReviewContext(mealId, legacy as unknown as PrismaClient);
    const legacyQueries = queries;
    queries = 0;
    const joined = await loadMealReviewContext(mealId, base);
    assert.deepEqual(joined, previous, 'Joined reads preserve every snapshot field and its version key');
    assert.ok(queries <= 4, 'Case/report, clarification forms and current policy versions stay within four SQL queries; patient limits join the case read');
    assert.ok(legacyQueries >= 12, 'Exercise a real nested profile/evidence context');
    const original = { where: { id: mealId }, include: { ingredients: true } };
    const preserved = preserveRelationQueryStrategy('findUnique', original);
    assert.equal((preserved as typeof preserved & { relationLoadStrategy: string }).relationLoadStrategy, 'query');
    assert.ok(!('relationLoadStrategy' in original), 'The compatibility default does not mutate arguments');
    assert.equal(preserveRelationQueryStrategy('update', original), original, 'Writes keep their original arguments');
    return { legacyQueries, joinedQueries: queries };
  } finally { await base.$disconnect(); }
}

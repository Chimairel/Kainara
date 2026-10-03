import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma, WeightLog } from '@prisma/client';
import { getWeightHistory, onboardingWeightId, recordOnboardingWeight } from '../src/services/weight-history.service';

const userId = 'fixture-member';
const startedAt = new Date('2026-10-04T02:00:00Z');
const makeLog = (weightKg: number, loggedAt: Date, id = 'weigh-in'): WeightLog => ({
  id,
  userId,
  weightKg,
  loggedAt,
  note: null,
});
function historyClient(logs: WeightLog[], report: unknown = null) {
  return {
    weightLog: {
      findMany: async (args: { where: { userId: string } }) => {
        assert.equal(args.where.userId, userId);
        return logs;
      },
    },
    nutritionReportVersion: {
      findFirst: async (args: { where: { userId: string }; orderBy: unknown }) => {
        assert.equal(args.where.userId, userId);
        assert.deepEqual(args.orderBy, { version: 'asc' });
        return report;
      },
    },
  } as unknown as Prisma.TransactionClient;
}
test('onboarding retries preserve the first weight and timestamp', async () => {
  let saved: WeightLog | undefined;
  const client = {
    weightLog: {
      upsert: async (args: { update: unknown; create: WeightLog }) => {
        assert.deepEqual(args.update, {});
        saved ??= { ...args.create, loggedAt: startedAt };
        return saved;
      },
    },
  } as unknown as Prisma.TransactionClient;
  await recordOnboardingWeight(client, userId, 57);
  await recordOnboardingWeight(client, userId, 60);
  assert.equal(saved?.weightKg, 57);
  assert.equal(saved?.id, onboardingWeightId(userId));
  assert.equal(saved?.loggedAt, startedAt);
});
test('new accounts return the persisted onboarding point without needing a report', async () => {
  const log = makeLog(57, startedAt, onboardingWeightId(userId));
  const client = historyClient([log]);
  client.nutritionReportVersion.findFirst = (() => assert.fail('A baseline already exists')) as never;
  assert.deepEqual(await getWeightHistory(userId, client), [{ ...log, source: 'ONBOARDING' }]);
});
test('existing accounts recover the original report weight, not the current mutable profile', async () => {
  const later = makeLog(59, new Date('2026-10-05T02:00:00Z'));
  const logs = await getWeightHistory(
    userId,
    historyClient([later], {
      id: 'first-report',
      generatedAt: startedAt,
      profileSnapshot: { profile: { weightKg: 57 } },
    })
  );
  assert.equal(logs.length, 2);
  assert.equal(logs[0].weightKg, 57);
  assert.equal(logs[0].source, 'INITIAL_REPORT');
  assert.equal(logs[0].loggedAt, startedAt);
  assert.equal(logs[1].weightKg, 59);
});
test('a report does not replace or duplicate an earlier genuine weigh-in', async () => {
  const log = makeLog(58, startedAt);
  assert.deepEqual(
    await getWeightHistory(
      userId,
      historyClient([log], {
        id: 'later-report',
        generatedAt: startedAt,
        profileSnapshot: { profile: { weightKg: 60 } },
      })
    ),
    [{ ...log, source: 'LOG' }]
  );
});
for (const snapshot of [null, {}, { profile: { weightKg: null } }, { profile: { weightKg: 0 } }]) {
  test(`missing or unsupported historical weight is not fabricated: ${JSON.stringify(snapshot)}`, async () => {
    assert.deepEqual(
      await getWeightHistory(
        userId,
        historyClient([], {
          id: 'report',
          generatedAt: startedAt,
          profileSnapshot: snapshot,
        })
      ),
      []
    );
  });
}

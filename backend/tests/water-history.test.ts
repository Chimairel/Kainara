import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prisma } from '@prisma/client';
import { WaterService } from '../src/services/water.service';

test('water history binds owner and Manila seven-day bounds and fills unlogged days without fabricated entries', async () => {
  let args: unknown[] = [];
  const client = { $queryRaw: async (...values: unknown[]) => {
    args = values;
    return [{ date: '2026-10-16', totalMl: 275, entryCount: 2, entries: [
      { id: 'latest', amountMl: 25, loggedAt: '2026-10-16T01:00:00.000Z' },
      { id: 'earlier', amountMl: 250, loggedAt: '2026-10-15T16:00:00.000Z' },
    ] }];
  } } as unknown as Prisma.TransactionClient;
  const history = await WaterService.getHistory('owner', new Date('2026-10-16T02:00:00Z'), client);
  assert.equal(history.days.length, 7);
  assert.equal(history.startDate, '2026-10-10');
  assert.equal(history.endDate, '2026-10-16');
  assert.equal(history.timeZone, 'Asia/Manila');
  assert.deepEqual(args.slice(1), ['owner', new Date('2026-10-09T16:00:00Z'), new Date('2026-10-16T16:00:00Z')]);
  assert.deepEqual(history.days[0], { date: '2026-10-10', totalMl: 0, entryCount: 0, entries: [] });
  assert.equal(history.days[6].totalMl, 275);
  assert.equal(history.days[6].entries[0].amountMl, 25);
});

test('water history changes its whole range at Philippine midnight independently of UTC date', async () => {
  const client = { $queryRaw: async () => [] } as unknown as Prisma.TransactionClient;
  const before = await WaterService.getHistory('owner', new Date('2026-10-15T15:59:59Z'), client);
  const after = await WaterService.getHistory('owner', new Date('2026-10-15T16:00:00Z'), client);
  assert.equal(before.endDate, '2026-10-15');
  assert.equal(after.endDate, '2026-10-16');
  assert.equal(after.days.length, 7);
  assert.ok(after.days.every(day => day.entryCount === 0 && day.entries.length === 0));
});

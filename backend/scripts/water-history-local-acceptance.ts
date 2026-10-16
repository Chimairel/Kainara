/** Real SQL, synthetic data, forced rollback. Never point this at Neon. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import prisma from '../src/lib/prisma';
import { WaterService } from '../src/services/water.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.equal(target.pathname, '/kainara_assistant_20261015');
  const rollback = new Error('WATER_HISTORY_FIXTURE_ROLLBACK');
  try {
    await prisma.$transaction(async tx => {
      const create = () => tx.user.create({ data: {
        name: 'Synthetic water history fixture', email: `water-history-${randomUUID()}@example.invalid`, passwordHash: 'disabled-fixture',
      } });
      const owner = await create();
      const other = await create();
      const now = new Date('2026-10-16T10:00:00Z');
      await tx.waterLog.createMany({ data: [
        { userId: owner.id, amountMl: 125, loggedAt: new Date('2026-10-09T16:00:00Z') },
        { userId: owner.id, amountMl: 200, loggedAt: new Date('2026-10-09T15:59:59Z') },
        { userId: owner.id, amountMl: 100, loggedAt: new Date('2026-10-15T15:59:59Z') },
        { userId: owner.id, amountMl: 250, loggedAt: new Date('2026-10-15T16:00:00Z') },
        { userId: owner.id, amountMl: 25, loggedAt: new Date('2026-10-16T02:00:00Z') },
        { userId: owner.id, amountMl: 900, loggedAt: new Date('2026-10-16T16:00:00Z') },
        { userId: other.id, amountMl: 1000, loggedAt: new Date('2026-10-16T02:00:00Z') },
      ] });
      const history = await WaterService.getHistory(owner.id, now, tx);
      assert.equal(history.days.length, 7);
      assert.equal(history.days[0].totalMl, 125);
      assert.equal(history.days[5].totalMl, 100);
      assert.equal(history.days[6].totalMl, 275);
      assert.equal(history.days[6].entryCount, 2);
      assert.equal(history.days[6].entries[0].amountMl, 25);
      assert.equal(history.days[6].entries[1].loggedAt, '2026-10-15T16:00:00.000Z');
      assert.ok(history.days[6].entries.every(entry => new Date(entry.loggedAt).toISOString() === entry.loggedAt));
      await tx.waterLog.createMany({ data: Array.from({ length: 50 }, (_, index) => ({
        userId: owner.id, amountMl: 50, loggedAt: new Date(+new Date('2026-10-16T03:00:00Z') + index * 60000),
      })) });
      const bounded = (await WaterService.getHistory(owner.id, now, tx)).days[6];
      assert.equal(bounded.totalMl, 2775);
      assert.equal(bounded.entryCount, 52);
      assert.equal(bounded.entries.length, 50);
      assert.equal(bounded.entries[0].loggedAt, '2026-10-16T03:49:00.000Z');
      await tx.waterLog.deleteMany({ where: { userId: owner.id,
        loggedAt: { gte: new Date('2026-10-15T16:00:00Z'), lt: new Date('2026-10-16T16:00:00Z') } } });
      const reset = await WaterService.getHistory(owner.id, now, tx);
      assert.equal(reset.days[6].entryCount, 0);
      assert.equal(reset.days[5].totalMl, 100);
      throw rollback;
    }, { timeout: 30000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal(await prisma.user.count({ where: { email: { startsWith: 'water-history-', endsWith: '@example.invalid' } } }), 0);
  console.log('PASS: owner isolation, Manila bounds, exact residuals, full totals with 50-entry detail cap, reset projection and fixture rollback.');
}
main().finally(() => prisma.$disconnect()).catch(error => { console.error(error); process.exitCode = 1; });

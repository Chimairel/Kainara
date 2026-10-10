/** Isolated SQL timeout and rollback checks. Refuses hosted/shared databases. */
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55488');
  assert.equal(target.pathname, '/kainara_transaction_test');
  assert.equal(process.env.NODE_ENV, 'test');
  await prisma.$executeRaw`CREATE TABLE "TimeoutProbe" (id integer PRIMARY KEY)`;
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_sleep(6)`;
      await tx.$executeRaw`INSERT INTO "TimeoutProbe" VALUES (1)`;
    });
    console.log('PASS implicit transaction survives six seconds and commits');

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_sleep(6)`;
      const isolation = await tx.$queryRaw<Array<{ transaction_isolation: string }>>`SHOW transaction_isolation`;
      assert.equal(isolation[0].transaction_isolation, 'serializable');
      await tx.$executeRaw`INSERT INTO "TimeoutProbe" VALUES (2)`;
    }, { isolationLevel: 'Serializable' });
    console.log('PASS isolation-only options inherit longer timeout and preserve serializable isolation');

    let attempts = 0;
    await assert.rejects(prisma.$transaction(async (tx) => {
      attempts++;
      await tx.$executeRaw`INSERT INTO "TimeoutProbe" VALUES (3)`;
      await tx.$executeRaw`SELECT pg_sleep(1.2)`;
      await tx.$queryRaw`SELECT 1`;
    }, { timeout: 1000 }), { code: 'P2028' });
    assert.equal(attempts, 1, 'An expired write transaction must not be replayed');
    console.log('PASS explicit short override still expires and does not replay writes');

    await assert.rejects(prisma.$transaction(async (tx) => {
      await tx.$executeRaw`INSERT INTO "TimeoutProbe" VALUES (4)`;
      throw new Error('Synthetic validation failure');
    }), /Synthetic validation failure/);
    const rows = await prisma.$queryRaw<Array<{ id: number }>>`SELECT id FROM "TimeoutProbe" ORDER BY id`;
    assert.deepEqual(rows.map(row => row.id), [1, 2]);
    console.log('PASS timeout and validation failures roll back their writes');
  } finally {
    await prisma.$executeRaw`DROP TABLE "TimeoutProbe"`;
  }
}
main().finally(() => prisma.$disconnect()).catch(error => {
  console.error(error);
  process.exitCode = 1;
});

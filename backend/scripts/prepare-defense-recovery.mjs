/** Create a fresh loopback recovery copy; never restore or modify the source. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes, createDecipheriv } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

async function main() {
  const source = dotenv.parse(readFileSync('.env'));
  const url = new URL(source.DATABASE_URL);
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.port, '55432');
  assert.equal(url.pathname, '/kainara_local_development');
  assert(process.argv.includes('--apply-local'), 'Use --apply-local to create the isolated local recovery copy.');
  const stamp = Date.now();
  const root = resolve(`.local/defense-recovery/${stamp}`);
  mkdirSync(root, { recursive: true });
  const container = `kainara-defense-recovery-${stamp}`;
  const database = 'kainara_defense_recovery';
  const password = randomBytes(32).toString('hex');
  const envFile = resolve(root, 'postgres.env');
  writeFileSync(envFile, `POSTGRES_PASSWORD=${password}\n`, { mode: 0o600, flag: 'wx' });
  const docker = (args, options = {}) =>
    execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, ...options });
  const archive = resolve(root, 'before-cleanup.dump');
  docker([
    'exec',
    'kainara-local-postgres',
    'pg_dump',
    '-U',
    url.username,
    '-d',
    url.pathname.slice(1),
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    '-f',
    '/tmp/defense-source.dump',
  ]);
  docker(['cp', 'kainara-local-postgres:/tmp/defense-source.dump', archive]);
  docker(['run', '-d', '--name', container, '--env-file', envFile, '-p', '127.0.0.1::5432', 'postgres:17-alpine']);
  for (let i = 0; ; i++) {
    try {
      docker(['exec', container, 'pg_isready', '-U', 'postgres']);
      break;
    } catch {
      assert(i < 30, 'Recovery PostgreSQL did not start');
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  docker(['cp', archive, `${container}:/tmp/source.dump`]);
  docker([
    'exec',
    container,
    'pg_restore',
    '--exit-on-error',
    '--no-owner',
    '--no-privileges',
    '-U',
    'postgres',
    '-d',
    database,
    '/tmp/source.dump',
  ]);
  const port = docker(['port', container, '5432'])
    .trim()
    .match(/^127\.0\.0\.1:(\d+)$/)?.[1];
  assert(port);
  const targetUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/${database}`;
  writeFileSync(
    resolve(root, 'application.env'),
    Object.entries({
      ...source,
      DATABASE_URL: targetUrl,
      NODE_ENV: 'development',
      GEMINI_API_KEY: '',
      BREVO_API_KEY: '',
      SMTP_PASS: '',
      PAYMONGO_SECRET_KEY: '',
    })
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join('\n') + '\n',
    { mode: 0o600 }
  );
  const db = new PrismaClient({ datasources: { db: { url: targetUrl } } });
  const counts = async () => {
    const tables = await db.$queryRaw`SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
    const result = {};
    for (const { tablename } of tables) {
      assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(tablename));
      const [row] = await db.$queryRawUnsafe(`SELECT count(*)::text AS count FROM "${tablename}"`);
      result[tablename] = Number(row.count);
    }
    return result;
  };
  try {
    const before = await counts();
    const preservedHashes = await db.user.findMany({ select: { id: true, passwordHash: true } });
    const documents = await db.clinicalDocument.findMany({
      select: { encryptedPayload: true, encryptionIv: true, encryptionAuthTag: true, sha256: true },
    });
    const key = Buffer.from(source.CLINICAL_DOCUMENT_ENCRYPTION_KEY, 'base64');
    for (const document of documents) {
      const decipher = createDecipheriv('aes-256-gcm', key, document.encryptionIv);
      decipher.setAuthTag(document.encryptionAuthTag);
      const payload = Buffer.concat([decipher.update(document.encryptedPayload), decipher.final()]);
      assert.equal(createHash('sha256').update(payload).digest('hex'), document.sha256);
    }
    const removed = await db.$transaction(async (tx) => {
      // Only this newly restored, isolated copy omits retired rows. Historical source triggers remain intact.
      await tx.$executeRawUnsafe('ALTER TABLE "FoodConsumptionStat" DISABLE TRIGGER USER');
      const deleted = await tx.foodConsumptionStat.deleteMany({
        where: { release: { source: { code: 'FNRI_ENNS_IFCS' } } },
      });
      await tx.$executeRawUnsafe('ALTER TABLE "FoodConsumptionStat" ENABLE TRIGGER USER');
      await tx.referenceDataRelease.updateMany({
        where: { source: { code: 'FNRI_ENNS_IFCS' } },
        data: { status: 'RETIRED', retiredAt: new Date() },
      });
      await tx.referenceDataSource.updateMany({ where: { code: 'FNRI_ENNS_IFCS' }, data: { isEnabled: false } });
      return deleted.count;
    });
    const childEnv = { ...process.env, ...source, DATABASE_URL: targetUrl, NODE_ENV: 'development' };
    const execute = (args) =>
      execFileSync(process.execPath, args, { env: childEnv, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    const dryRun = execute([
      '--import',
      'tsx',
      'scripts/dev-test-accounts.ts',
      '--set',
      'sleep-oct11',
      '--spec',
      '.local/sleep-oct11/accounts.json',
    ]);
    const token = dryRun.match(/Confirmation: (devdb-[a-f0-9]+)/)?.[1];
    assert(token);
    writeFileSync(
      resolve(root, 'accounts.log'),
      execute([
        '--import',
        'tsx',
        'scripts/dev-test-accounts.ts',
        '--set',
        'sleep-oct11',
        '--spec',
        '.local/sleep-oct11/accounts.json',
        '--apply',
        '--confirm-target',
        token,
      ])
    );
    for (const account of preservedHashes)
      assert.equal(
        (await db.user.findUniqueOrThrow({ where: { id: account.id }, select: { passwordHash: true } })).passwordHash,
        account.passwordHash
      );
    const after = await counts();
    const [constraints] =
      await db.$queryRaw`SELECT count(*)::text AS count FROM pg_constraint WHERE contype='f' AND NOT convalidated`;
    assert.equal(Number(constraints.count), 0);
    assert.equal(after.FoodConsumptionStat, 0);
    for (const table of ['FoodItem', 'MealPlan', 'ClinicalDocument', 'ClinicalProfileReview', 'MealPlanReviewDecision'])
      assert.equal(after[table], before[table]);
    docker([
      'exec',
      container,
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      database,
      '--format=custom',
      '--no-owner',
      '--no-privileges',
      '-f',
      '/tmp/prepared.dump',
    ]);
    const prepared = resolve(root, 'prepared.dump');
    docker(['cp', `${container}:/tmp/prepared.dump`, prepared]);
    const manifest = {
      measuredAt: new Date().toISOString(),
      source: 'Verified local October 10 recovery with current migrations and verified local additions',
      sourceSha256: createHash('sha256').update(readFileSync(archive)).digest('hex'),
      preparedSha256: createHash('sha256').update(readFileSync(prepared)).digest('hex'),
      container,
      target: `127.0.0.1:${port}/${database}`,
      before,
      after,
      ennRowsExcluded: removed,
      existingPasswordsPreserved: preservedHashes.length,
      documentsDecryptedAndVerified: documents.length,
      invalidForeignKeys: 0,
      omissions: [
        'Original hosted activity after the October 10 14:00 PHT backup is unavailable. Synthetic accounts are recreated; old clarification answers and approvals are not reconstructed.',
      ],
      archive: prepared,
    };
    writeFileSync(resolve(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(
      JSON.stringify({
        directory: root,
        target: manifest.target,
        users: after.User,
        meals: after.MealPlan,
        ennRowsExcluded: removed,
        documentsVerified: documents.length,
        passwordsPreserved: preservedHashes.length,
      })
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Local recovery preparation failed. Source is unchanged; inspect the isolated copy and rerun after correcting the recovery gate.'
  );
  process.exitCode = 1;
});

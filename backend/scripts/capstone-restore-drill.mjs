/** Restore a local archive into a newly created, isolated Docker database. Never reads DATABASE_URL. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers/promises';

const argument = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const archiveRoot = resolve('.local/backups');
const archive = resolve(argument('archive') ?? '');
const rel = relative(archiveRoot, archive);
assert(rel && !rel.startsWith('..') && !isAbsolute(rel), 'Use an archive inside backend/.local/backups.');
const manifest = JSON.parse(readFileSync(argument('manifest') ?? archive + '.manifest.json', 'utf8'));
const digest = createHash('sha256').update(readFileSync(archive)).digest('hex');
assert.equal(digest, manifest.sha256, 'Archive checksum must match its recorded backup manifest.');
const suffix = Date.now().toString();
const container = `codex-capstone-restore-${suffix}`;
const database = 'kainara_capstone_restore';
const directory = resolve('.local/capstone-restore', suffix);
mkdirSync(directory, { recursive: true });
const docker = (args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const sql = (query) =>
  docker([
    'exec',
    container,
    'psql',
    '-X',
    '-v',
    'ON_ERROR_STOP=1',
    '-U',
    'postgres',
    '-d',
    database,
    '-Atc',
    query,
  ]).trim();
let created = false;
const started = performance.now();
try {
  const smoke = argument('application-smoke') === 'true';
  // An ephemeral loopback port is reserved by Docker for this container only.
  docker([
    'run',
    '-d',
    '--name',
    container,
    ...(smoke ? ['-p', '127.0.0.1::5432'] : []),
    '-e',
    'POSTGRES_PASSWORD=isolated-restore-only',
    'postgres:17-alpine',
  ]);
  created = true;
  for (let attempt = 0; ; attempt++) {
    try {
      docker(['exec', container, 'pg_isready', '-U', 'postgres']);
      break;
    } catch {
      assert(attempt < 30, 'Disposable PostgreSQL failed to start');
      await setTimeout(1000);
    }
  }
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  docker(['cp', archive, `${container}:/tmp/restore.dump`]);
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
    '/tmp/restore.dump',
  ]);
  const restoreMs = Math.round(performance.now() - started);
  const tables = [
    'User',
    'MealPlan',
    'MealPlanReviewDecision',
    'ClinicalProfileReview',
    'AuditEvent',
    'MealReviewSnapshot',
    '_prisma_migrations',
  ];
  const existing = sql("SELECT tablename FROM pg_tables WHERE schemaname='public'").split('\n');
  const counts = Object.fromEntries(
    tables
      .filter((table) => existing.includes(table))
      .map((table) => [table, Number(sql(`SELECT COUNT(*) FROM "${table}"`))])
  );
  for (const required of ['User', 'MealPlan', 'ClinicalProfileReview', 'AuditEvent', '_prisma_migrations'])
    assert(counts[required] > 0, `Restored ${required} history must exist`);
  const invalidConstraints = Number(sql("SELECT COUNT(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated"));
  assert.equal(invalidConstraints, 0, 'All restored foreign keys must be validated');
  const duplicatePlans = Number(
    sql(
      'SELECT COUNT(*) FROM (SELECT "mealPlanId" FROM "MealLog" WHERE "mealPlanId" IS NOT NULL GROUP BY "mealPlanId" HAVING COUNT(*) > 1) groups'
    )
  );
  const duplicateDays = Number(
    sql(
      'SELECT COUNT(*) FROM (SELECT "userId", "logDate" FROM "DailyNutritionLog" GROUP BY "userId", "logDate" HAVING COUNT(*) > 1) groups'
    )
  );
  assert.equal(duplicatePlans + duplicateDays, 0, 'Existing data-integrity preflight must pass');
  // Exercise joins used by audit reads, without exporting identities, snapshots or credentials.
  const relatedProfiles = Number(
    sql('SELECT COUNT(*) FROM "ClinicalProfileReview" r JOIN "User" u ON u.id=r."userId"')
  );
  assert.equal(relatedProfiles, counts.ClinicalProfileReview);
  let application = 'Not requested';
  if (smoke) {
    const port = docker(['port', container, '5432'])
      .trim()
      .match(/^127\.0\.0\.1:(\d+)$/)?.[1];
    assert(port, 'The restore must use its allocated loopback port');
    const env = {
      ...process.env,
      DATABASE_URL: `postgresql://postgres:isolated-restore-only@127.0.0.1:${port}/${database}`,
      NODE_ENV: 'test',
      CAPSTONE_RESTORE_DRILL: 'true',
      CLINICAL_CLARIFICATIONS_ENABLED: 'true',
      MEMBERSHIP_ENABLED: 'false',
      GEMINI_API_KEY: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      BREVO_API_KEY: '',
      PAYMONGO_SECRET_KEY: '',
      GOOGLE_CLIENT_ID: '',
      JWT_SECRET: 'synthetic-restore-access-secret-32chars',
      JWT_REFRESH_SECRET: 'synthetic-restore-refresh-secret-32chars',
      CRON_SECRET: 'synthetic-restore-cron-secret-32chars',
    };
    const execute = (args) =>
      execFileSync(process.execPath, args, { env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    writeFileSync(
      resolve(directory, 'migrations.log'),
      execute(['node_modules/prisma/build/index.js', 'migrate', 'deploy'])
    );
    application = execute(['--import', 'tsx', 'scripts/capstone-restored-api-smoke.ts']);
    writeFileSync(resolve(directory, 'application.log'), application);
  }
  const result = {
    archiveSha256: digest,
    measuredAt: new Date().toISOString(),
    restoreMs,
    tableCount: existing.length,
    counts,
    invalidConstraints,
    duplicatePlans,
    duplicateDays,
    relatedProfiles,
    application,
    scope:
      'Full PostgreSQL restore, constraints, retained review/audit rows and data-integrity SQL; optional current API smoke on the migrated isolated copy. No browser journey.',
    container,
  };
  writeFileSync(resolve(directory, 'result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
} finally {
  if (created) docker(['stop', container]);
  // Retain the stopped container for inspection. No deletion and no shared target mutation.
}

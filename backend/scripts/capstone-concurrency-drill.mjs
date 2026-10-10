/** Repeatable role/concurrency acceptance in fresh loopback databases only. */
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { performance } from 'node:perf_hooks';
import { setTimeout } from 'node:timers/promises';

const container = `codex-capstone-concurrency-${Date.now()}`;
const directory = resolve('.local/capstone-concurrency', container);
mkdirSync(directory, { recursive: true });
const docker = (args) => execFileSync('docker', args, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
const run = (args, env) =>
  new Promise((accept, reject) => {
    const child = spawn(process.execPath, args, { env, windowsHide: true });
    let output = '';
    child.stdout.on('data', (data) => {
      output += String(data);
    });
    child.stderr.on('data', (data) => {
      output += String(data);
    });
    child.on('error', reject);
    child.on('close', (code) => accept({ code, output }));
  });
const started = performance.now();
let created = false;
const results = [];
try {
  // Each downstream script independently rejects any other port/name and requires an empty database.
  docker([
    'run',
    '-d',
    '--name',
    container,
    '-p',
    '127.0.0.1:55488:5432',
    '-e',
    'POSTGRES_PASSWORD=synthetic-concurrency-only',
    'postgres:17-alpine',
  ]);
  created = true;
  for (let attempt = 0; ; attempt++) {
    try {
      docker(['exec', container, 'pg_isready', '-U', 'postgres']);
      break;
    } catch {
      assert(attempt < 30);
      await setTimeout(1000);
    }
  }
  for (const [database, script] of [
    ['kainara_profile_proposals', 'profile-proposal-local-acceptance.ts'],
    ['kainara_meal_context', 'meal-context-local-acceptance.ts'],
    ['kainara_review_references', 'review-reference-local-acceptance.ts'],
  ]) {
    docker(['exec', container, 'createdb', '-U', 'postgres', database]);
    const env = {
      ...process.env,
      DATABASE_URL: `postgresql://postgres:synthetic-concurrency-only@127.0.0.1:55488/${database}?connection_limit=8`,
      NODE_ENV: 'test',
      CLINICAL_CLARIFICATIONS_ENABLED: 'true',
      MEMBERSHIP_ENABLED: 'false',
      JWT_SECRET: 'synthetic-concurrency-access-secret-32chars',
      JWT_REFRESH_SECRET: 'synthetic-concurrency-refresh-secret-32chars',
      GEMINI_API_KEY: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      BREVO_API_KEY: '',
      PAYMONGO_SECRET_KEY: '',
      GOOGLE_CLIENT_ID: '',
      CLINICAL_DOCUMENT_ENCRYPTION_KEY: 'b'.repeat(64),
      CRON_SECRET: 'synthetic-concurrency-cron-secret-32chars',
    };
    const migration = await run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'], env);
    writeFileSync(resolve(directory, `${database}-migrations.log`), migration.output);
    assert.equal(migration.code, 0, `Local migration failed for ${database}`);
    const turnStarted = performance.now();
    const result = await run(['--import', 'tsx', `scripts/${script}`], env);
    writeFileSync(resolve(directory, `${database}-acceptance.log`), result.output);
    results.push({
      database,
      script,
      exitCode: result.code,
      elapsedMs: Math.round(performance.now() - turnStarted),
      checks: result.output.split('\n').filter((line) => line.startsWith('PASS ')),
    });
    assert.equal(result.code, 0, `Acceptance failed: ${script}; inspect its local log`);
    if (database === 'kainara_meal_context') {
      const evaluation = await run(['--import', 'tsx', 'scripts/capstone-evaluation.ts'], env);
      writeFileSync(resolve(directory, 'synthetic-evaluation.log'), evaluation.output);
      assert.equal(evaluation.code, 0);
    }
  }
  console.log(JSON.stringify({ elapsedMs: Math.round(performance.now() - started), results, directory }, null, 2));
} finally {
  writeFileSync(
    resolve(directory, 'result.json'),
    JSON.stringify({ measuredAt: new Date().toISOString(), results }, null, 2) + '\n'
  );
  if (created) docker(['stop', container]);
}

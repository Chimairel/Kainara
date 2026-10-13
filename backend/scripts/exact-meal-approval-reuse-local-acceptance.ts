/** Disposable database owned by this test. No shared runtime or external provider calls. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';

async function main() {
  const root = resolve(__dirname, '../..');
  const container = 'kainara-local-postgres';
  const docker = (args: string[], input?: string) =>
    execFileSync('docker', args, {
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 32 * 1024 * 1024,
    });
  const inspected = JSON.parse(docker(['inspect', container]))[0];
  assert.equal(inspected.Config.Labels['com.docker.compose.project'], 'kainara-local-development');
  assert.deepEqual(inspected.HostConfig.PortBindings['5432/tcp'], [{ HostIp: '127.0.0.1', HostPort: '55432' }]);
  const database = `kainara_exact_reuse_${randomBytes(4).toString('hex')}`;
  const password = parse(
    readFileSync(resolve(root, 'backend/.local/local-development/postgres.env'))
  ).LOCAL_POSTGRES_PASSWORD;
  assert.ok(typeof password === 'string' && /^[a-f0-9]{64}$/.test(password));
  const url = `postgresql://postgres:${password}@127.0.0.1:55432/${database}?schema=public`;
  Object.assign(process.env, {
    DATABASE_URL: url,
    DIRECT_URL: url,
    NODE_ENV: 'test',
    CLINICAL_CLARIFICATIONS_ENABLED: 'true',
    JWT_SECRET: randomBytes(32).toString('hex'),
    JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
    MEMBERSHIP_ENABLED: 'false',
    SMTP_VERIFY_ON_STARTUP: 'false',
  });
  for (const key of [
    'GEMINI_API_KEY',
    'SMTP_USER',
    'SMTP_PASS',
    'BREVO_API_KEY',
    'PAYMONGO_SECRET_KEY',
    'GOOGLE_CLIENT_ID',
  ])
    process.env[key] = '';
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  try {
    const ddl = execFileSync(
      process.execPath,
      [
        resolve(root, 'backend/node_modules/prisma/build/index.js'),
        'migrate',
        'diff',
        '--from-empty',
        '--to-schema-datamodel',
        resolve(root, 'backend/prisma/schema.prisma'),
        '--script',
      ],
      {
        cwd: resolve(root, 'backend'),
        env: process.env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: 32 * 1024 * 1024,
      }
    );
    docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], ddl);
    const { runReviewReferenceAcceptance } = await import('./review-reference-local-acceptance');
    await runReviewReferenceAcceptance();
  } finally {
    docker(['exec', container, 'dropdb', '-U', 'postgres', database]);
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

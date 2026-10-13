/** Real history SQL against a fresh synthetic database in the owned loopback container. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parse } from 'dotenv';

async function main() {
  const root = resolve(__dirname, '../..');
  const container = 'kainara-local-postgres';
  const docker = (args: string[], input?: string) => execFileSync('docker', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  const inspected = JSON.parse(docker(['inspect', container]))[0];
  assert.equal(inspected.Config.Labels['com.docker.compose.project'], 'kainara-local-development');
  assert.deepEqual(inspected.HostConfig.PortBindings['5432/tcp'], [{ HostIp: '127.0.0.1', HostPort: '55432' }]);
  const database = `kainara_audit_changes_${randomBytes(4).toString('hex')}`;
  assert.match(database, /^kainara_audit_changes_[a-f0-9]{8}$/);
  const password = parse(readFileSync(resolve(root, 'backend/.local/local-development/postgres.env'))).LOCAL_POSTGRES_PASSWORD;
  assert.match(password, /^[a-f0-9]{64}$/);
  const url = `postgresql://postgres:${password}@127.0.0.1:55432/${database}?schema=public`;
  Object.assign(process.env, { DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test' });
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  const ddl = execFileSync(process.execPath, [resolve(root, 'backend/node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', resolve(root, 'backend/prisma/schema.prisma'), '--script'], { cwd: resolve(root, 'backend'), env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], ddl);
  const { default: db } = await import('../src/lib/prisma');
  const { StaffAuditService } = await import('../src/services/staff-audit.service');
  try {
    const actions = ['ADMIN_REVIEW_SENSITIVE_DETAILS_ACCESSED', 'ADMIN_REVIEW_SENSITIVE_FILE_ACCESSED', 'ADMIN_MEAL_LOG_DETAILS_ACCESSED', 'NUTRITIONIST_LICENSE_DOCUMENT_ACCESSED', 'ADMIN_MEAL_DRAFT_CREATED', 'USER_SUSPENDED', 'MEAL_BASE_FLAGGED', 'NUTRITIONIST_ACCESS_REVOKED'];
    await db.auditEvent.createMany({ data: actions.map((action, index) => ({ id: `admin-${index}`, actorRole: 'ADMIN' as const, actorName: 'Synthetic admin', action, entityType: 'User', entityId: 'synthetic-subject', createdAt: new Date(Date.UTC(2026, 9, 13, 12, index)) })) });
    await db.auditEvent.createMany({ data: ['RND_REVIEW_SAVED_CONTEXT_ACCESSED', 'BASE_MEAL_VERIFIED'].map((action, index) => ({ id: `rnd-${index}`, actorRole: 'NUTRITIONIST' as const, actorName: 'Synthetic RND', action, entityType: 'User', entityId: 'synthetic-subject', createdAt: new Date(Date.UTC(2026, 9, 13, 13, index)) })) });
    const first = await StaffAuditService.history({ view: 'admin', changesOnly: true, limit: 2 }, db);
    const second = await StaffAuditService.history({ view: 'admin', changesOnly: true, limit: 2, page: 2 }, db);
    assert.equal(first.total, 4); assert.equal(first.totalPages, 2); assert.equal(first.rows.length, 2); assert.equal(second.rows.length, 2);
    assert.deepEqual(new Set([...first.rows, ...second.rows].map(row => row.actionCode)), new Set(actions.slice(4)));
    assert.equal(second.rows.find(row => row.actionCode === 'ADMIN_MEAL_DRAFT_CREATED')?.action, 'Created a meal draft');
    assert.equal((await StaffAuditService.history({ view: 'admin', changesOnly: true, action: 'ACCESSED' }, db)).total, 0);
    assert.equal((await StaffAuditService.history({ view: 'admin', changesOnly: true, action: 'ACCESS' }, db)).rows[0].actionCode, 'NUTRITIONIST_ACCESS_REVOKED');
    const related = await StaffAuditService.history({ view: 'admin', changesOnly: true, relatedTo: 'admin-4' }, db);
    assert.equal(related.total, 5); assert.ok(related.rows.every(row => !row.actionCode.endsWith('_ACCESSED')));
    assert.equal((await StaffAuditService.history({ view: 'nutritionist', changesOnly: true }, db)).total, 1);
    assert.equal((await StaffAuditService.history({ view: 'nutritionist' }, db)).total, 2);
    assert.equal((await StaffAuditService.history({ view: 'admin' }, db)).total, 8);
    assert.equal(await db.auditEvent.count(), 10);
    console.log('PASS: real PostgreSQL history excludes read-access rows before counts and paging; filters, related/RND changes, creation labels and retained access records verified.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error : 'Local admin audit acceptance failed; no hosted target was used.'); process.exitCode = 1; });

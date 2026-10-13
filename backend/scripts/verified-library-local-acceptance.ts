/** Verified catalogue paging against a fresh synthetic database in the owned loopback container. */
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
  const database = `kainara_verified_library_${randomBytes(4).toString('hex')}`;
  assert.match(database, /^kainara_verified_library_[a-f0-9]{8}$/);
  const password = parse(readFileSync(resolve(root, 'backend/.local/local-development/postgres.env'))).LOCAL_POSTGRES_PASSWORD;
  assert.match(password, /^[a-f0-9]{64}$/);
  const url = `postgresql://postgres:${password}@127.0.0.1:55432/${database}?schema=public`;
  Object.assign(process.env, { DATABASE_URL: url, DIRECT_URL: url, NODE_ENV: 'test' });
  docker(['exec', container, 'createdb', '-U', 'postgres', database]);
  const ddl = execFileSync(process.execPath, [resolve(root, 'backend/node_modules/prisma/build/index.js'), 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', resolve(root, 'backend/prisma/schema.prisma'), '--script'], { cwd: resolve(root, 'backend'), env: process.env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
  docker(['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', database], ddl);
  const { default: db } = await import('../src/lib/prisma');
  const { getNutritionistMealLibraryWithFilters: list } = await import('../src/services/nutritionist-library-query.service');
  const { libraryBaseRevisionKey } = await import('../src/services/meal-base-admission.service');
  try {
    const food = { mealName: 'Synthetic verified meal', mealType: 'LUNCH' as const, calories: 450, proteinG: 25, carbsG: 45, fatG: 15, recipeSignature: 'a'.repeat(64), description: 'Current recipe' };
    const root = await db.mealLibrary.create({ data: { ...food, addedAt: new Date('2026-10-10') } });
    await db.mealLibrary.create({ data: { ...food, mealName: 'Pending newer family variant', recipeSignature: 'e'.repeat(64), recipeFamilyId: root.id, addedAt: new Date('2026-10-13') } });
    const other = await db.mealLibrary.create({ data: { ...food, mealName: 'Second verified meal', recipeSignature: 'b'.repeat(64), addedAt: new Date('2026-10-11') } });
    const stale = await db.mealLibrary.create({ data: { ...food, mealName: 'Stale evidence meal', recipeSignature: 'c'.repeat(64) } });
    const held = await db.mealLibrary.create({ data: { ...food, status: 'FLAGGED', mealName: 'Held meal', recipeSignature: 'd'.repeat(64) } });
    for (const meal of [root, other, stale, held]) await db.mealBaseVerification.create({ data: {
      targetKind: 'LIBRARY_MEAL', targetId: meal.id, revisionKey: libraryBaseRevisionKey(meal.recipeSignature!, meal.id === stale.id ? 'Old recipe' : meal.description), status: 'VERIFIED',
    } });
    const first = await list('synthetic-staff', { limit: 1 });
    const second = await list('synthetic-staff', { limit: 1, page: 2 });
    assert.equal(first.total, 2); assert.equal(second.total, 2);
    assert.deepEqual([first.meals[0].id, second.meals[0].id], [other.id, root.id]);
    assert.ok([...first.meals, ...second.meals].every(meal => meal.baseVerification === 'VERIFIED'));
    assert.equal((await list('synthetic-staff', { search: 'Pending' })).total, 0);
    assert.equal((await list('synthetic-staff', { status: 'FLAGGED' })).total, 0);
    assert.equal(await db.mealLibrary.count(), 5);
    console.log('PASS: verified library filters current revisions before grouping/counts/paging; pending newer variants cannot hide verified family members; held/stale meals stay excluded and records remain stored.');
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error instanceof assert.AssertionError ? error : 'Local verified library acceptance failed; no hosted target was used.'); process.exitCode = 1; });

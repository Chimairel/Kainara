import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('local restore, migration and API switch refuse missing or hosted target confirmations before Docker/database access', () => {
  const helper = resolve(__dirname, '../../scripts/local-database.mjs');
  for (const action of ['restore', 'migrate', 'use']) {
    for (const confirmation of [[], ['--confirm-target=hosted-neon-database']]) {
      const result = spawnSync(process.execPath, [helper, action, ...confirmation], {
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: 'postgresql://must-never-connect:private@unreachable.invalid/hosted' },
      });
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Confirm this local target/);
      assert.doesNotMatch(result.stderr, /private|unreachable|docker.*failed/i);
    }
  }
});

test('isolated API refuses hosted configuration before starting the server', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nutrimind-isolation-'));
  try {
    writeFileSync(
      join(directory, '.env.test.local'),
      'DATABASE_URL=postgresql://synthetic:private@unreachable.invalid/test\nPORT=5001\n'
    );
    const result = spawnSync(process.execPath, [resolve(__dirname, '../scripts/start-isolated-api.mjs')], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Hosted targets are refused/);
    assert.doesNotMatch(result.stderr, /postgresql:\/\/|private@/);
  } finally {
    if (!directory.startsWith(join(tmpdir(), 'nutrimind-isolation-')))
      throw new Error('Unexpected fixture cleanup path');
    rmSync(directory, { recursive: true });
  }
});

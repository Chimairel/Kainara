/** Authenticated synthetic read benchmark; secrets and response bodies never enter results. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { distribution } from './helpers/capstone-statistics';

async function main() {
  const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
  const base = new URL(arg('base') ?? 'http://127.0.0.1:5000');
  assert(['127.0.0.1', 'localhost'].includes(base.hostname), 'Read benchmark is loopback only.');
  const credentialFile = arg('accounts');
  assert(credentialFile, 'Pass the ignored test-account credential JSON with --accounts=PATH.');
  const credentials = JSON.parse(readFileSync(credentialFile, 'utf8')) as { newAccountPassword: string };
  const prefix = arg('email-prefix');
  assert(prefix?.startsWith('qa-'), 'Only marked qa- synthetic accounts may be used.');
  const userId = arg('member-id');
  assert(userId?.startsWith('devfixture_'), 'Use a marked devfixture_ member.');
  const samples = Number(arg('samples') ?? 3),
    concurrency = Number(arg('concurrency') ?? 1);
  assert(Number.isInteger(samples) && samples >= 1 && samples <= 10);
  assert(Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 4);
  const results = [];
  for (const [alias, path] of [
    ['member-heart', '/user/meals/workspace'],
    ['rnd', `/nutritionist/profile-work/${userId}`],
    ['admin', '/admin/audit-history?view=nutritionist&limit=5'],
  ]) {
    const email = `${prefix}${alias}@example.test`;
    const login = await fetch(new URL('/api/auth/login', base), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: credentials.newAccountPassword }),
      signal: AbortSignal.timeout(60000),
    });
    assert.equal(login.status, 200, `Synthetic ${alias} login failed (${login.status})`);
    const body = (await login.json()) as { data: { accessToken: string } };
    const cookie = login.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const durations: number[] = [];
    const statuses: Record<string, number> = {};
    let next = 0;
    try {
      await Promise.all(
        Array.from({ length: concurrency }, async () => {
          while (next++ < samples) {
            const started = performance.now();
            let status = 'transport-failure';
            try {
              const response = await fetch(new URL('/api' + path, base), {
                headers: { Authorization: `Bearer ${body.data.accessToken}` },
                signal: AbortSignal.timeout(90000),
              });
              status = String(response.status);
              await response.arrayBuffer();
            } catch {
              /* Report failure without exporting payloads or tokens. */
            }
            durations.push(performance.now() - started);
            statuses[status] = (statuses[status] ?? 0) + 1;
          }
        })
      );
      results.push({ role: alias, samples, concurrency, statuses, elapsed: distribution(durations) });
    } finally {
      // Revoke only this benchmark's refresh cookie, not other open synthetic sessions.
      const logout = await fetch(new URL('/api/auth/logout', base), {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/json' },
        body: '{}',
        signal: AbortSignal.timeout(60000),
      });
      assert.equal(logout.status, 200, 'Benchmark session cleanup failed');
    }
  }
  const report = {
    measuredAt: new Date().toISOString(),
    base: base.origin,
    results,
    scope:
      'Authenticated software reads on marked accounts; includes HTTP/auth/database latency. Not clinical or production load validation.',
  };
  mkdirSync('.local/capstone-evaluation', { recursive: true });
  const file = resolve('.local/capstone-evaluation', `reads-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ file, ...report }, null, 2));
  assert(
    results.every((result) => Object.keys(result.statuses).every((status) => status === '200')),
    'One or more role reads failed'
  );
}
main().catch(() => {
  console.error('Read benchmark failed; check its aggregate result and synthetic account availability.');
  process.exitCode = 1;
});

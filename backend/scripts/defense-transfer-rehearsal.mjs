/** Byte-counting loopback proxy. Never points at Neon or modifies normal localhost configuration. */
import assert from 'node:assert/strict';
import { createServer, connect } from 'node:net';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, createWriteStream } from 'node:fs';
import { resolve, relative } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';

async function main() {
  const root = resolve(
    process.argv
      .find((value) => value.startsWith('--recovery-dir='))
      ?.split('=')
      .slice(1)
      .join('=') ?? ''
  );
  const rel = relative(resolve('.local/defense-recovery'), root);
  assert(rel && !rel.startsWith('..'), 'Use an owned recovery directory.');
  const settings = dotenv.parse(readFileSync(resolve(root, 'application.env')));
  const target = new URL(settings.DATABASE_URL);
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.pathname, '/kainara_defense_recovery');
  const upstreamPort = Number(target.port);
  let received = 0;
  const queryBytes = new Map();
  const sockets = new Set();
  const proxy = createServer((socket) => {
    const upstream = connect(upstreamPort, '127.0.0.1');
    const statements = new Map();
    let clientBuffer = Buffer.alloc(0),
      startup = true,
      query = 'protocol';
    // Observe statement text only, never Bind values or returned records.
    socket.on('data', (chunk) => {
      clientBuffer = Buffer.concat([clientBuffer, chunk]);
      if (startup && clientBuffer.length >= 4) {
        const length = clientBuffer.readUInt32BE(0);
        if (clientBuffer.length < length) return;
        clientBuffer = clientBuffer.subarray(length);
        startup = false;
      }
      while (!startup && clientBuffer.length >= 5) {
        const length = clientBuffer.readUInt32BE(1);
        if (clientBuffer.length < length + 1) break;
        const type = String.fromCharCode(clientBuffer[0]),
          body = clientBuffer.subarray(5, length + 1);
        if (type === 'P') {
          const split = body.indexOf(0),
            name = body.subarray(0, split).toString();
          const text = body.subarray(split + 1, body.indexOf(0, split + 1)).toString();
          statements.set(name, text);
          query = text;
        } else if (type === 'B') {
          const split = body.indexOf(0);
          const name = body.subarray(split + 1, body.indexOf(0, split + 1)).toString();
          query = statements.get(name) ?? 'protocol';
        } else if (type === 'Q') query = body.subarray(0, body.length - 1).toString();
        clientBuffer = clientBuffer.subarray(length + 1);
      }
    });
    sockets.add(socket);
    sockets.add(upstream);
    upstream.on('data', (chunk) => {
      received += chunk.length;
      queryBytes.set(query, (queryBytes.get(query) ?? 0) + chunk.length);
    });
    socket.on('error', () => upstream.destroy());
    upstream.on('error', () => socket.destroy());
    socket.on('close', () => {
      upstream.destroy();
      sockets.delete(socket);
    });
    upstream.on('close', () => {
      socket.destroy();
      sockets.delete(upstream);
    });
    socket.pipe(upstream);
    upstream.pipe(socket);
  });
  await new Promise((yes) => proxy.listen(0, '127.0.0.1', yes));
  target.port = String(proxy.address().port);
  target.searchParams.set('sslmode', 'disable');
  const stages = [];
  const log = createWriteStream(resolve(root, 'transfer-private.log'));
  const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/defense-transfer-worker.ts'], {
    env: {
      ...process.env,
      ...settings,
      DATABASE_URL: target.toString(),
      NODE_ENV: 'test',
      DEFENSE_TRANSFER_REHEARSAL: 'true',
      CLINICAL_CLARIFICATIONS_ENABLED: 'true',
      MEMBERSHIP_ENABLED: 'false',
      GEMINI_API_KEY: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      BREVO_API_KEY: '',
      PAYMONGO_SECRET_KEY: '',
      GOOGLE_CLIENT_ID: '',
    },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  let current;
  child.on('message', (message) => {
    if (message.type === 'start') {
      current = { label: message.label, before: received, start: performance.now(), queryBefore: new Map(queryBytes) };
      child.send({ type: 'ack' });
    }
    if (message.type === 'end') {
      assert(current);
      stages.push({
        label: current.label,
        databaseResponseBytes: received - current.before,
        elapsedMs: Math.round(performance.now() - current.start),
        ...message.details,
        ...(current.label === 'ten-session-steady'
          ? {
              largestStatements: [...queryBytes]
                .map(([statement, bytes]) => ({
                  statement: statement.replace(/\s+/g, ' ').slice(0, 500),
                  databaseResponseBytes: bytes - (current.queryBefore.get(statement) ?? 0),
                }))
                .sort((a, b) => b.databaseResponseBytes - a.databaseResponseBytes)
                .slice(0, 10),
            }
          : {}),
      });
      if (current.label.startsWith('read:')) console.log(JSON.stringify(stages.at(-1)));
      child.send({ type: 'ack' });
    }
  });
  const code = await new Promise((yes) => child.once('exit', yes));
  for (const socket of sockets) socket.destroy();
  await new Promise((yes) => proxy.close(yes));
  log.end();
  const baseline = stages.find((stage) => stage.label === 'fnri-full-baseline');
  const identity = stages.find((stage) => stage.label === 'fnri-identities-cold');
  const steady = stages.find((stage) => stage.label === 'ten-session-steady');
  const generation = stages.find((stage) => stage.label === 'weekly-generation');
  const reduction = baseline && identity ? 1 - identity.databaseResponseBytes / baseline.databaseResponseBytes : 0;
  const cadenceMs = steady ? steady.ticks * steady.intervalSeconds * 1000 : 0;
  const hourly = steady ? (steady.databaseResponseBytes * 3600000) / Math.min(steady.elapsedMs, cadenceMs) : Infinity;
  const result = {
    measuredAt: new Date().toISOString(),
    scope:
      'Actual PostgreSQL server-to-client TCP bytes on a loopback restore; includes protocol/auth overhead. Not browser payload bytes or a provider quota reading.',
    stages,
    totalDatabaseResponseBytes: received,
    fnriReductionPercent: reduction * 100,
    tenSessionProjectedBytesPerHour: Math.round(hourly),
    workerExitCode: code,
    passed:
      code === 0 &&
      reduction >= 0.9 &&
      hourly <= 50_000_000 &&
      generation?.databaseResponseBytes <= 25_000_000 &&
      generation?.meals === 21,
  };
  writeFileSync(resolve(root, 'transfer-result.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  assert(result.passed, 'Transfer or workflow gate failed; inspect private evidence before release.');
}
main().catch(() => {
  console.error('Transfer rehearsal failed. Only the owned local recovery copy was used.');
  process.exitCode = 1;
});

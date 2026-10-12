import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import dotenv from 'dotenv';
import process from 'node:process';
import { URL } from 'node:url';
import { log, error } from 'node:console';

const configPath = resolve('.env.test.local');
if (!existsSync(configPath))
  throw new Error('Create the ignored backend/.env.test.local with an isolated database and PORT=5001.');
dotenv.config({ path: configPath, override: true, quiet: true });
const target = new URL(process.env.DATABASE_URL || '');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname) || process.env.PORT !== '5001') {
  throw new Error('Isolated API requires a loopback database and PORT=5001. Hosted targets are refused.');
}
if (process.env.DIRECT_URL && !['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.DIRECT_URL).hostname)) {
  throw new Error('Isolated API refuses a hosted DIRECT_URL.');
}
log('Starting isolated test API on port 5001 with a loopback database.');
const child = spawn(process.execPath, [resolve('node_modules/tsx/dist/cli.mjs'), 'watch', 'src/server.ts'], {
  env: process.env,
  stdio: 'inherit',
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
child.on('error', () => {
  error('Isolated API could not start.');
  process.exitCode = 1;
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

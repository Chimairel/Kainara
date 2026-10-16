/** Read-only source comparison. Never contacts a host or opens a database. */
import { execFileSync } from 'node:child_process';
import process from 'node:process';

const args = process.argv.slice(2);
const supported = new Set(['--source', '--target', '--assert', '--assert-checkout']);
for (let index = 0; index < args.length; index++) {
  if (!supported.has(args[index])) throw new Error(`Unknown option: ${args[index]}`);
  if (['--source', '--target'].includes(args[index])) {
    if (!args[++index] || args[index].startsWith('-')) throw new Error('A Git ref is required.');
  }
}
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const git = (...values) => execFileSync('git', values, { encoding: 'utf8', windowsHide: true }).trim();
const resolveRef = (ref) => git('rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`);
const sourceRef = option('--source', 'HEAD');
const targetRef = option('--target', 'origin/demo');
const source = resolveRef(sourceRef);
const target = resolveRef(targetRef);
const paths = [
  'backend/src',
  'backend/prisma',
  'backend/data',
  'backend/package.json',
  'backend/package-lock.json',
  'backend/tsconfig.json',
  'backend/Dockerfile',
  'frontend/src',
  'frontend/public',
  'frontend/characters',
  'frontend/package.json',
  'frontend/package-lock.json',
  'frontend/tsconfig.json',
  'frontend/next.config.mjs',
  'frontend/tailwind.config.ts',
  'frontend/postcss.config.mjs',
  'frontend/Dockerfile',
  '.nvmrc',
  'railway.json',
  'railway.toml',
  'vercel.json',
];
const lines = (value) => (value ? value.split(/\r?\n/) : []);
const differences = lines(git('diff', '--name-status', source, target, '--', ...paths));
const workingChanges = lines(git('diff', '--name-status', 'HEAD', '--', ...paths));
const untrackedFiles = lines(git('ls-files', '--others', '--exclude-standard', '--', ...paths));
const result = {
  source: { ref: sourceRef, sha: source },
  target: { ref: targetRef, sha: target },
  committedApplicationFilesMatch: differences.length === 0,
  differences,
  checkoutMatchesHead: workingChanges.length === 0 && untrackedFiles.length === 0,
  workingChanges,
  untrackedFiles,
  scope:
    'Application source, schema, reference data, assets, dependencies and runtime configuration files. Environment secrets and database records are intentionally excluded.',
  hostedStateVerified: false,
};
console.log(JSON.stringify(result, null, 2));
if (args.includes('--assert') && differences.length) process.exitCode = 1;
if (args.includes('--assert-checkout') && (workingChanges.length || untrackedFiles.length)) process.exitCode = 1;

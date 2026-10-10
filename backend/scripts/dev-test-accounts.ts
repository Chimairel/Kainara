/** CLI only: create synthetic development accounts without changing application authorization. */
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import {
  accountSpecSchema,
  assertWriteTarget,
  databaseTarget,
  defaultAccountSpecs,
} from './helpers/dev-test-account-config';
import { createAccounts, inspectAccounts } from './helpers/dev-test-account-writer';
import { sharedTestAccountPassword } from '../src/services/dev-test-accounts/password';

async function main() {
  dotenv.config({ path: path.resolve(__dirname, '../.env') });
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.log(
      'npm run test:accounts -- [--set qa] [--spec file.json] [--apply --confirm-target TOKEN --allow-shared-development]\nDry run is the default. New accounts share a server-configured password, saved in the ignored local credential guide. Optional DEV_TEST_ACCOUNT_PASSWORD must be at least 8 characters and at most 72 UTF-8 bytes. Existing passwords are preserved.'
    );
    return;
  }
  const values = new Set(['--set', '--spec', '--confirm-target']);
  const switches = new Set(['--apply', '--allow-shared-development']);
  const options = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    if (options.has(args[i])) throw new Error('Duplicate CLI options are refused.');
    if (values.has(args[i])) {
      if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Missing value for ${args[i]}.`);
      options.set(args[i], args[++i]);
    } else if (switches.has(args[i])) options.set(args[i], 'true');
    else throw new Error('Unknown CLI option. Use --help.');
  }
  const target = databaseTarget(process.env.DATABASE_URL ?? '', process.env);
  const set = options.get('--set') ?? 'qa';
  const specFile = options.get('--spec');
  const specs = specFile ? accountSpecSchema.parse(JSON.parse(readFileSync(specFile, 'utf8'))) : defaultAccountSpecs;
  const apply = args.includes('--apply');
  if (apply) assertWriteTarget(target, args);
  const db = new PrismaClient();
  try {
    console.log(
      `Target: ${target.label}\nConfirmation: ${target.token}\nMode: ${apply ? 'CREATE ONLY' : 'DRY RUN (no writes)'}`
    );
    const plan = await inspectAccounts(db, set, specs);
    for (const item of plan) console.log(`${item.exists ? 'KEEP' : 'CREATE'} ${item.role}: ${item.email}`);
    console.log(
      'Existing accounts, passwords, reviews and global routing settings are preserved. Active test RNDs join the configured review pool.'
    );
    if (!apply) return;
    if (plan.every((item) => item.exists)) {
      console.log('Complete: all accounts already exist. Use the original credential guide; passwords were not reset.');
      return;
    }
    const password = sharedTestAccountPassword(process.env);
    const directory = path.resolve(__dirname, '../.local/dev-test-accounts');
    mkdirSync(directory, { recursive: true });
    const guidePath = path.join(directory, `${set}-${Date.now()}-${randomBytes(4).toString('hex')}.json`);
    // Reserve the credentials before database writes; retain them if the transaction fails and must be retried.
    writeFileSync(
      guidePath,
      JSON.stringify(
        {
          status: 'PREPARED; see CLI result for transaction completion',
          target: target.label,
          fixtureSet: set,
          login: 'http://localhost:3000/login',
          newAccountPassword: password,
          accounts: plan.map((item) => ({ email: item.email, role: item.role, passwordApplies: !item.exists })),
        },
        null,
        2
      ),
      { flag: 'wx', mode: 0o600 }
    );
    console.log(`Local credentials: ${guidePath} (password is not printed or committed)`);
    const result = await createAccounts(db, set, specs, password);
    writeFileSync(
      guidePath,
      JSON.stringify(
        {
          status: 'COMPLETE',
          target: target.label,
          fixtureSet: set,
          login: 'http://localhost:3000/login',
          newAccountPassword: password,
          accounts: result.map((item) => ({ email: item.email, role: item.role, passwordApplies: !item.exists })),
        },
        null,
        2
      ),
      { mode: 0o600 }
    );
    console.log(
      `Complete: ${result.filter((item) => !item.exists).length} created; ${result.filter((item) => item.exists).length} unchanged. Sign in through the ordinary localhost login.`
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    'Account setup failed. Verify runtime/target confirmation, JSON specification and existing account collisions. No existing account is overwritten; creation is transactional. Use --help for syntax.'
  );
  process.exitCode = 1;
});

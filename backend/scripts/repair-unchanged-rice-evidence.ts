/** Dry run by default. An operator must confirm the exact target and a fresh verified full backup. */
import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Prisma, PrismaClient } from '@prisma/client';
import { applyUnchangedRiceRepair, previewUnchangedRiceRepair } from '../src/services/unchanged-rice-repair.service';

const args = process.argv.slice(2);
const value = (flag: string) => {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
};
const target = new URL(process.env.DATABASE_URL ?? '');
const local = ['127.0.0.1', 'localhost'].includes(target.hostname);
const confirmedDefense =
  target.hostname === 'ep-soft-bonus-b35ab8jw.c-4.ap-southeast-1.aws.neon.tech' && target.pathname === '/neondb';
if (!['postgres:', 'postgresql:'].includes(target.protocol) || (!local && !confirmedDefense))
  throw new Error('Only local acceptance or the established defense database is allowed.');
const label = local
  ? `${target.hostname}:${target.port}${target.pathname}`
  : 'nameless-dust-38810716/br-round-art-b355gp02/neondb';
const userId = value('--user-id'),
  cycleId = value('--cycle-id');
if (!userId || !cycleId) throw new Error('Supply an explicit --user-id and --cycle-id.');
const db = new PrismaClient({ log: [] });

async function main() {
  if (!args.includes('--apply')) {
    const preview = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        return previewUnchangedRiceRepair(tx, userId!, cycleId!);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 }
    );
    console.log(
      JSON.stringify({
        mode: 'DRY_RUN',
        target: label,
        userId,
        cycleId,
        eligible: preview.candidates.length,
        fingerprint: preview.fingerprint,
        candidates: preview.candidates,
        nutritionUnchanged: true,
        clinicalApprovalGranted: false,
      })
    );
    return;
  }
  if (value('--confirm-target') !== label) throw new Error('Confirm the exact database target printed by the dry run.');
  const fingerprint = value('--expect-fingerprint'),
    backupPath = value('--verified-backup'),
    checksum = value('--backup-sha256');
  if (!fingerprint || !backupPath || !checksum)
    throw new Error('A dry-run fingerprint and verified full backup are required.');
  const backup = await readFile(backupPath);
  if (backup.subarray(0, 5).toString() !== 'PGDMP' || createHash('sha256').update(backup).digest('hex') !== checksum)
    throw new Error('Verified custom PostgreSQL backup fingerprint differs.');
  const result = await db.$transaction((tx) => applyUnchangedRiceRepair(tx, userId!, cycleId!, fingerprint), {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    timeout: 60000,
  });
  console.log(
    JSON.stringify({
      mode: 'APPLY',
      target: label,
      ...result,
      nutritionUnchanged: true,
      clinicalApprovalGranted: false,
    })
  );
}
main()
  .catch(() => {
    console.error('Rice evidence repair stopped. Target, context and backup must match the verified dry run.');
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

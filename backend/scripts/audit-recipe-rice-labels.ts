import 'dotenv/config';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient, type RecipeRiceRole, type RiceRoleReviewStatus } from '@prisma/client';
import { proposeRiceRole } from '../src/domain/recipe-rice-role.policy';
import { parseRecipeCandidateIngredients } from '../src/services/panlasang-recipe-candidate.provider';

const prisma = new PrismaClient();
const apply = process.argv.includes('--apply');
const database = new URL(process.env.DATABASE_URL ?? '');
const target = createHash('sha256').update(`${database.hostname}${database.pathname}`).digest('hex').slice(0, 16);
type Label = {
  riceRole: RecipeRiceRole | null;
  riceRoleReviewStatus: RiceRoleReviewStatus;
  includedRiceG: number | null;
};
type Change = {
  kind: 'source' | 'library';
  name: string;
  reason: string;
  before: Label & { id: string; updatedAt: Date };
  after: Label;
};

async function main() {
  const [sources, library] = await Promise.all([
    prisma.rawRecipeCandidate.findMany({
      where: { sourceName: 'PANLASANG_PINOY' },
      select: {
        id: true,
        recipeName: true,
        category: true,
        ingredients: true,
        riceRole: true,
        riceRoleReviewStatus: true,
        includedRiceG: true,
        updatedAt: true,
      },
      orderBy: { id: 'asc' },
    }),
    prisma.mealLibrary.findMany({
      where: {
        derivationKind: 'ORIGINAL',
        OR: [
          { sourceRawRecipeCandidate: { is: { sourceName: 'PANLASANG_PINOY' } } },
          { description: { contains: 'Source: https://panlasangpinoy.com/' } },
        ],
      },
      select: {
        id: true,
        mealName: true,
        riceRole: true,
        riceRoleReviewStatus: true,
        includedRiceG: true,
        updatedAt: true,
        sourceRawRecipeCandidate: { select: { category: true } },
        ingredients: { select: { ingredientName: true, quantity: true, unit: true } },
      },
      orderBy: { id: 'asc' },
    }),
  ]);
  const changes: Change[] = [];
  const unresolved: Array<{ kind: string; name: string }> = [];
  const counts: Record<string, number> = {};
  let reviewedPreserved = 0;
  function audit(
    kind: Change['kind'],
    name: string,
    category: string | null,
    ingredients: Parameters<typeof proposeRiceRole>[0]['ingredients'],
    before: Change['before']
  ) {
    if (before.riceRoleReviewStatus === 'REVIEWED') {
      reviewedPreserved++;
      return;
    }
    const proposal = proposeRiceRole({ name, category, ingredients });
    const after: Label = {
      riceRole: proposal.riceRole,
      includedRiceG: proposal.includedRiceG,
      riceRoleReviewStatus: proposal.riceRole ? 'PROPOSED' : 'NOT_REVIEWED',
    };
    const key = `${kind}:${after.riceRole ?? 'UNCLASSIFIED'}`;
    counts[key] = (counts[key] ?? 0) + 1;
    if (!after.riceRole) unresolved.push({ kind, name });
    if (
      before.riceRole !== after.riceRole ||
      before.riceRoleReviewStatus !== after.riceRoleReviewStatus ||
      before.includedRiceG !== after.includedRiceG
    ) {
      changes.push({ kind, name, reason: proposal.reasonCode, before, after });
    }
  }
  for (const row of sources) {
    const { id, updatedAt, riceRole, riceRoleReviewStatus, includedRiceG } = row;
    audit('source', row.recipeName, row.category, parseRecipeCandidateIngredients(row.ingredients), {
      id,
      updatedAt,
      riceRole,
      riceRoleReviewStatus,
      includedRiceG,
    });
  }
  for (const row of library) {
    const { id, updatedAt, riceRole, riceRoleReviewStatus, includedRiceG } = row;
    audit(
      'library',
      row.mealName,
      row.sourceRawRecipeCandidate?.category ?? null,
      row.ingredients.map((i) => ({ name: i.ingredientName, quantity: i.quantity, unit: i.unit })),
      { id, updatedAt, riceRole, riceRoleReviewStatus, includedRiceG }
    );
  }
  const directory = path.resolve('.data-audit-backups');
  await mkdir(directory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-');
  const manifest = path.join(directory, `rice-labels-${apply ? 'apply-backup' : 'audit'}-${stamp}.json`);
  // Metadata-only before images support rollback without exporting patient/account records.
  const content = JSON.stringify(
    {
      policy: 'SAVED_RICE_LABELS_V1',
      target,
      sources: sources.length,
      library: library.length,
      reviewedPreserved,
      counts,
      unresolved,
      changes,
    },
    null,
    2
  );
  await writeFile(manifest, content, { encoding: 'utf8', flag: 'wx' });
  await writeFile(`${manifest}.sha256`, createHash('sha256').update(content).digest('hex') + '\n', { flag: 'wx' });
  console.log(
    JSON.stringify(
      {
        apply,
        target,
        sources: sources.length,
        library: library.length,
        reviewedPreserved,
        counts,
        changes: changes.length,
        unresolved: unresolved.length,
        manifest,
      },
      null,
      2
    )
  );
  if (!apply || !changes.length) return;
  if (!process.argv.includes(`--expected-target=${target}`))
    throw new Error('Apply requires the target fingerprint from the dry-run.');
  const groups = new Map<string, Change[]>();
  for (const change of changes) {
    const key = JSON.stringify([change.kind, change.after]);
    groups.set(key, [...(groups.get(key) ?? []), change]);
  }
  await prisma.$transaction(
    async (tx) => {
      for (const group of groups.values()) {
        for (let offset = 0; offset < group.length; offset += 100) {
          const batch = group.slice(offset, offset + 100);
          const where = { OR: batch.map((change) => change.before) };
          const result =
            batch[0].kind === 'source'
              ? await tx.rawRecipeCandidate.updateMany({ where, data: batch[0].after })
              : await tx.mealLibrary.updateMany({ where, data: batch[0].after });
          if (result.count !== batch.length)
            throw new Error('Catalogue changed during audit; all label updates rolled back.');
        }
      }
    },
    { timeout: 120_000 }
  );
  console.log(JSON.stringify({ applied: changes.length, backup: manifest }));
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

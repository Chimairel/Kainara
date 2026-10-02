import 'dotenv/config';
import { existsSync } from 'node:fs';
import prisma from '../src/lib/prisma';
import { fixtureCatalogueWhere, retireFixtureCatalogue } from '../src/services/retire-fixture-catalogue.service';

async function main() {
  const database = new URL(process.env.DATABASE_URL ?? '');
  const rows = await prisma.mealLibrary.findMany({
    where: fixtureCatalogueWhere,
    select: { status: true, _count: { select: { mealPlans: true } } },
  });
  console.log(
    JSON.stringify({
      mode: 'preflight',
      databaseHost: database.hostname,
      recipes: rows.length,
      active: rows.filter((row) => row.status !== 'ARCHIVED').length,
      referencedPlans: rows.reduce((sum, row) => sum + row._count.mealPlans, 0),
    })
  );
  if (!process.argv.includes('--apply')) return;
  if (!process.env.FIXTURE_RETIREMENT_BACKUP_PATH || !existsSync(process.env.FIXTURE_RETIREMENT_BACKUP_PATH))
    throw new Error('Provide the verified database backup path before applying retirement.');
  if (process.env.FIXTURE_RETIREMENT_DATABASE_HOST !== database.hostname)
    throw new Error('Explicit target hostname confirmation is required.');
  console.log(JSON.stringify(await retireFixtureCatalogue()));
}
main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Catalogue retirement failed.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

/** Read-only catalogue audit. No account/profile data or database writes. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import prisma from '../src/lib/prisma';
import { toPublicRawRecipeImage } from '../src/domain/meal-image.policy';
import { resolveLibraryRecipeImages } from '../src/services/library-recipe-image.service';
import { formatMealTitle } from '../../frontend/src/lib/meal-title';
import { reviewedMealImages } from '../../frontend/src/components/user/reviewed-meal-images';
import {
  planImageSelect,
  rawRecipeImageSelect,
  resolvePlanImage,
} from '../src/services/meal-plan-presentation.service';

type Check = { state: 'available' | 'broken' | 'unverified'; reason: string; checkedAt: string };
type AuditImage = { url: string; fallback?: { url: string } | null; attribution: { sourcePageUrl?: string | null } };
type Row = {
  kind: string;
  id: string;
  sourceTitle: string;
  displayTitle: string;
  sourcePage: string | null;
  image: AuditImage | null;
  storedImage: string | null;
};
const output = '.local/meal-presentation-audit';

async function main() {
  const target = new URL(process.env.DATABASE_URL!);
  assert.equal(target.hostname.replace('-pooler', ''), 'ep-soft-bonus-b35ab8jw.c-4.ap-southeast-1.aws.neon.tech');
  assert.equal(target.pathname, '/neondb');
  await mkdir(output, { recursive: true });
  let rows: Row[];
  if (process.argv.includes('--check-images') || process.argv.includes('--from-cache')) {
    rows = JSON.parse(await readFile(`${output}/catalogue.json`, 'utf8'));
  } else {
    const raw = await prisma.rawRecipeCandidate.findMany({
      select: {
        id: true,
        recipeName: true,
        sourceName: true,
        sourceUrl: true,
        sourceImageUrl: true,
        sourceVideoUrl: true,
      },
      orderBy: { id: 'asc' },
    });
    const library = await prisma.mealLibrary.findMany({
      select: {
        id: true,
        mealName: true,
        description: true,
        adaptedImageUrl: true,
        imagePublicId: true,
        imageVersion: true,
        imageFormat: true,
        imageKind: true,
        imageAltText: true,
        imageCreator: true,
        imageSourcePageUrl: true,
        imageLicenseCode: true,
        imageLicenseUrl: true,
        sourceRawRecipeCandidate: { select: rawRecipeImageSelect },
      },
      orderBy: { id: 'asc' },
    });
    const sources = await resolveLibraryRecipeImages(library);
    rows = [
      ...raw.map((r) => ({
        kind: 'raw-recipe',
        id: r.id,
        sourceTitle: r.recipeName,
        displayTitle: formatMealTitle(r.recipeName),
        sourcePage: r.sourceUrl,
        image: toPublicRawRecipeImage(r),
        storedImage: r.sourceImageUrl,
      })),
      ...library.map((r) => ({
        kind: 'library',
        id: r.id,
        sourceTitle: r.mealName,
        displayTitle: formatMealTitle(r.mealName),
        sourcePage:
          r.sourceRawRecipeCandidate?.sourceUrl ||
          r.description?.match(/(?:^|\n)\s*Source:\s*(https:\/\/[^\s<>"']+)/i)?.[1] ||
          null,
        image: resolvePlanImage({ libraryMeal: r, sourceRawRecipeCandidate: r.sourceRawRecipeCandidate }, sources),
        storedImage: r.adaptedImageUrl || null,
      })),
    ];
    const names = await prisma.mealPlan.findMany({ select: { mealName: true }, distinct: ['mealName'] });
    const plans = await prisma.mealPlan.findMany({ select: planImageSelect });
    const uniquePresentations = new Map<string, Row>();
    for (const plan of plans) {
      const image = resolvePlanImage(plan, sources);
      const key = `${plan.mealName}|${image?.url || ''}`;
      uniquePresentations.set(key, {
        kind: 'saved-plan-presentation',
        id: `presentation-${createHash('sha256').update(key).digest('hex').slice(0, 16)}`,
        sourceTitle: plan.mealName,
        displayTitle: formatMealTitle(plan.mealName),
        sourcePage: image?.attribution.sourcePageUrl || null,
        image,
        storedImage: null,
      });
    }
    rows.push(...uniquePresentations.values());
    const logs = await prisma.mealLog.findMany({
      where: { source: { in: ['SYSTEM_GENERATED', 'USER_SWAPPED'] } },
      select: { mealName: true },
      distinct: ['mealName'],
    });
    await writeFile(
      `${output}/recorded-titles.json`,
      JSON.stringify(
        [...new Set([...names, ...logs].map((r) => r.mealName))].map((sourceTitle) => ({
          sourceTitle,
          displayTitle: formatMealTitle(sourceTitle),
        })),
        null,
        2
      )
    );
    await writeFile(`${output}/catalogue.json`, JSON.stringify(rows, null, 2));
  }
  await prisma.$disconnect();
  rows = rows.map((row) => ({
    ...row,
    displayTitle: formatMealTitle(row.sourceTitle),
    image: row.image || reviewedMealImages[row.sourceTitle.trim().toLowerCase()] || null,
  }));
  await writeFile(`${output}/catalogue.json`, JSON.stringify(rows, null, 2));
  const urls = [
    ...new Set(
      rows.flatMap((r) => [r.storedImage, r.image?.url, r.image?.fallback?.url].filter((u): u is string => Boolean(u)))
    ),
  ];
  let checks: Record<string, Check> = {};
  try {
    checks = JSON.parse(await readFile(`${output}/url-checks.json`, 'utf8'));
  } catch {
    /* First run. */
  }
  if (process.argv.includes('--check-images')) {
    let cursor = 0;
    async function worker() {
      while (cursor < urls.length) {
        const url = urls[cursor++];
        if (checks[url] && checks[url].state !== 'unverified') continue;
        const checkedAt = new Date().toISOString();
        try {
          if (url.startsWith('/meals/')) {
            const file = await readFile(`../frontend/public${url}`);
            checks[url] = { state: file.length ? 'available' : 'broken', reason: 'Bundled reviewed asset', checkedAt };
            continue;
          }
          const parsed = new URL(url);
          // Do not follow arbitrary database URLs to private hosts or redirect destinations.
          if (
            parsed.protocol !== 'https:' ||
            !['panlasangpinoy.com', 'res.cloudinary.com', 'i.ytimg.com', 'upload.wikimedia.org'].includes(
              parsed.hostname
            )
          ) {
            checks[url] = { state: 'unverified', reason: 'Outside public image-host allowlist', checkedAt };
            continue;
          }
          const response = await fetch(url, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(10000) });
          const type = response.headers.get('content-type') || '';
          checks[url] = {
            state:
              response.ok && type.startsWith('image/')
                ? 'available'
                : [404, 410].includes(response.status) || (response.ok && !type.startsWith('image/'))
                  ? 'broken'
                  : 'unverified',
            reason: `HTTP ${response.status}; ${type || 'no content type'}`,
            checkedAt,
          };
          await response.body?.cancel();
        } catch {
          checks[url] = { state: 'unverified', reason: 'Network failure or timeout', checkedAt };
        }
        if (cursor % 100 === 0) console.log(`Checked ${cursor}/${urls.length} distinct image URLs`);
      }
    }
    await Promise.all(Array.from({ length: 6 }, worker));
    await writeFile(`${output}/url-checks.json`, JSON.stringify(checks, null, 2));
  }
  // Public recipe metadata only; no saved-plan/account identifiers in the handoff.
  const csv = (value: unknown) => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  const catalogue = rows.filter((row) => row.kind !== 'saved-plan-presentation');
  const issues = catalogue.filter(
    (row) =>
      !row.image ||
      [row.storedImage, row.image.url, row.image.fallback?.url].some((url) => url && checks[url]?.state === 'broken')
  );
  const csvRows = issues.map((row) => {
    const primary = row.image ? checks[row.image.url] : null;
    const fallback = row.image?.fallback ? checks[row.image.fallback.url] : null;
    const status = !row.image
      ? 'MISSING'
      : primary?.state === 'broken' && fallback?.state !== 'available'
        ? 'BROKEN'
        : 'BROKEN_SECONDARY_URL';
    const faulty = [row.storedImage, row.image?.url, row.image?.fallback?.url].filter(
      (url) => url && checks[url]?.state === 'broken'
    );
    return [
      status,
      row.displayTitle,
      row.kind,
      row.id,
      row.sourceTitle,
      row.sourcePage,
      row.image?.url,
      faulty.join(' | '),
      '',
      '',
    ];
  });
  await writeFile(
    `${output}/image-handoff.csv`,
    '\ufeff' +
      [
        [
          'status',
          'meal',
          'record_type',
          'record_id',
          'source_title',
          'source_page',
          'current_image_url',
          'broken_urls',
          'your_image_filename',
          'attribution_or_ownership',
        ],
        ...csvRows,
      ]
        .map((row) => row.map(csv).join(','))
        .join('\n') +
      '\n'
  );
  await writeFile(
    `${output}/title-cleanup.csv`,
    '\ufeff' +
      [
        ['record_type', 'record_id', 'source_title', 'display_title'],
        ...catalogue
          .filter((row) => row.sourceTitle !== row.displayTitle)
          .map((row) => [row.kind, row.id, row.sourceTitle, row.displayTitle]),
      ]
        .map((row) => row.map(csv).join(','))
        .join('\n') +
      '\n'
  );
  const summary = {
    timestamp: new Date().toISOString(),
    readOnly: true,
    target: 'defense-neon',
    rawRecipes: rows.filter((r) => r.kind === 'raw-recipe').length,
    libraryRecipes: rows.filter((r) => r.kind === 'library').length,
    savedPlanPresentations: rows.filter((r) => r.kind === 'saved-plan-presentation').length,
    changedCatalogueTitles: catalogue.filter((r) => r.sourceTitle !== r.displayTitle).length,
    distinctCatalogueTitlesCleaned: new Set(
      catalogue.filter((r) => r.sourceTitle !== r.displayTitle).map((r) => r.sourceTitle)
    ).size,
    missingCatalogueImages: catalogue.filter((r) => !r.image).length,
    distinctMealsMissingImages: new Set(issues.filter((r) => !r.image).map((r) => r.displayTitle.toLowerCase())).size,
    distinctImageUrls: urls.length,
    checks: urls
      .flatMap((url) => (checks[url] ? [checks[url]] : []))
      .reduce((counts, c) => ({ ...counts, [c.state]: (counts[c.state] || 0) + 1 }), {} as Record<string, number>),
  };
  await writeFile(`${output}/summary.json`, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary));
}
main()
  .catch(() => {
    console.error('Audit failed; inspect the target/configuration privately.');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

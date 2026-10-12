import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createHash } from 'node:crypto';
import manifest from '../src/data/panlasang-cloudinary-images.json';
import { toPublicRawRecipeImage } from '../src/domain/meal-image.policy';
import { resolvePlanImage, resolveRecordedPlanImage } from '../src/services/meal-plan-presentation.service';
import { resolveLibraryRecipeImages } from '../src/services/library-recipe-image.service';
import prisma from '../src/lib/prisma';
import { AdminMealImageService } from '../src/services/admin-meal-image.service';

const toast = {
  sourceRecordId: 'pp_how-to-make-french-toast',
  recipeName: 'How to Make French Toast - The Basic Recipe',
  sourceName: 'PANLASANG_PINOY',
  sourceUrl: 'https://panlasangpinoy.com/how-to-make-french-toast/',
  sourceImageUrl: null,
  sourceVideoUrl: null,
};
const library = {
  id: 'toast-library',
  mealName: toast.recipeName,
  description: `Source: ${toast.sourceUrl}`,
  imagePublicId: null,
  imageVersion: null,
  imageFormat: null,
  imageKind: null,
  imageAltText: null,
  imageCreator: null,
  imageSourcePageUrl: null,
  imageLicenseCode: null,
  imageLicenseUrl: null,
};
function cloud(context: TestContext, name = manifest.cloudName) {
  const previous = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_CLOUD_NAME = name;
  context.after(() => {
    if (previous === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
    else process.env.CLOUDINARY_CLOUD_NAME = previous;
  });
}

test('recovered manifest has unique exact source identities and inventoried upload IDs', () => {
  const entries = Object.entries(manifest.recipes);
  assert.equal(entries.length, 1951);
  assert.equal(entries.filter(([, photo]) => photo.kind === 'REPRESENTATIVE').length, 22);
  assert.equal(new Set(entries.map(([, photo]) => photo.sourceRecordId)).size, entries.length);
  for (const [sourceUrl, photo] of entries) {
    assert.equal(new URL(sourceUrl).hostname, 'panlasangpinoy.com');
    assert.equal(
      photo.publicId,
      `nutrimind/recipe-catalogue/${createHash('sha256').update(photo.sourceRecordId).digest('hex').slice(0, 28)}`
    );
    assert.match(photo.version, /^\d+$/);
    assert.match(photo.format, /^(jpg|jpeg|png|webp|avif)$/);
  }
});

test('French Toast recovers its uploaded photo and actual original credit', (context) => {
  cloud(context);
  const image = toPublicRawRecipeImage(toast);
  assert.match(
    image!.url,
    /^https:\/\/res\.cloudinary\.com\/veafrhuq\/image\/upload\/f_auto,q_auto,w_960,c_limit\/v\d+\/nutrimind\/recipe-catalogue\//
  );
  assert.equal(image?.kind, 'REPRESENTATIVE');
  assert.equal(image?.attribution.creator, 'The Kitchn');
  assert.ok(image?.attribution.sourcePageUrl?.startsWith('https://cdn.apartmenttherapy.info/'));
  assert.equal(image?.attribution.licenseCode, null);
});

test('only recorded aliases of the same exact source page share an uploaded photo', (context) => {
  cloud(context);
  const photo = manifest.recipes['https://panlasangpinoy.com/chicken-tinola/'];
  const recipe = { ...toast, sourceUrl: 'https://panlasangpinoy.com/chicken-tinola/', recipeName: 'Tinola' };
  assert.equal(toPublicRawRecipeImage({ ...recipe, sourceRecordId: photo.sourceRecordId })?.kind, 'EXACT');
  assert.equal(
    toPublicRawRecipeImage({
      ...recipe,
      sourceName: 'DEMO_STANDARD_PORTION',
      sourceRecordId: photo.sourceRecordAliases[0],
    })?.kind,
    'REPRESENTATIVE'
  );
  assert.equal(toPublicRawRecipeImage({ ...recipe, sourceRecordId: 'unrecorded-demo' }), null);
});

test('unknown source IDs, similar pages, unsupported providers and different clouds do not inherit photos', (context) => {
  cloud(context);
  assert.equal(toPublicRawRecipeImage({ ...toast, sourceRecordId: 'other-recipe' }), null);
  assert.equal(toPublicRawRecipeImage({ ...toast, sourceUrl: toast.sourceUrl + '?other=1' }), null);
  assert.equal(toPublicRawRecipeImage({ ...toast, sourceName: 'USER_OBSERVED' }), null);
  process.env.CLOUDINARY_CLOUD_NAME = 'another-cloud';
  assert.equal(toPublicRawRecipeImage(toast), null);
});

test('Cloudinary keeps article and video delivery fallbacks, with source attribution on each', (context) => {
  cloud(context);
  const image = toPublicRawRecipeImage({
    ...toast,
    sourceRecordId: 'pp_make-coleslaw',
    recipeName: 'Coleslaw',
    sourceUrl: 'https://panlasangpinoy.com/make-coleslaw/',
    sourceImageUrl: 'https://panlasangpinoy.com/wp-content/uploads/2014/10/coleslaw.jpg',
    sourceVideoUrl: 'https://youtu.be/uXi6QDOdhGg',
  });
  assert.equal(image?.attribution.creator, 'BBC Food');
  assert.equal(image?.fallback?.attribution.creator, 'Panlasang Pinoy');
  assert.match(image!.fallback!.url, /panlasangpinoy.com\/wp-content/);
  assert.equal(image?.fallback?.fallback?.url, 'https://i.ytimg.com/vi/uXi6QDOdhGg/mqdefault.jpg');
});

test('library, saved plan and matching recorded history resolve the same recovered source photo', async (context) => {
  cloud(context);
  const original = prisma.rawRecipeCandidate.findMany;
  prisma.rawRecipeCandidate.findMany = (async () => [toast]) as typeof original;
  context.after(() => {
    prisma.rawRecipeCandidate.findMany = original;
  });
  const images = await resolveLibraryRecipeImages([library]);
  const rawImage = toPublicRawRecipeImage(toast);
  const plan = { libraryMeal: library, sourceRawRecipeCandidate: toast, mealName: toast.recipeName };
  assert.deepEqual(images.get(library.id), rawImage);
  assert.deepEqual(resolvePlanImage(plan, images), rawImage);
  assert.deepEqual(resolveRecordedPlanImage({ mealName: toast.recipeName, mealPlan: plan }, images), rawImage);
  assert.equal(resolveRecordedPlanImage({ mealName: 'Different eaten meal', mealPlan: plan }, images), null);
});

test('a custom exact photo still wins and a user swap cannot inherit the former raw source', (context) => {
  cloud(context);
  const custom = { ...library, adaptedImageUrl: 'https://res.cloudinary.com/veafrhuq/image/upload/custom.jpg' };
  assert.equal(resolvePlanImage({ libraryMeal: custom, sourceRawRecipeCandidate: toast })?.url, custom.adaptedImageUrl);
  assert.equal(resolvePlanImage({ sourceRawRecipeCandidate: toast, selectionEvidence: { source: 'USER_SWAP' } }), null);
  assert.equal(toPublicRawRecipeImage({ ...toast, sourceName: 'DEMO_STANDARD_PORTION' })?.kind, 'REPRESENTATIVE');
});

test('admin image catalogue displays the shared source photo without pretending it is a removable custom upload', async (context) => {
  cloud(context);
  const originals = {
    meals: prisma.mealLibrary.findMany,
    count: prisma.mealLibrary.count,
    raw: prisma.rawRecipeCandidate.findMany,
  };
  prisma.mealLibrary.findMany = (async () => [
    { ...library, mealType: 'BREAKFAST', status: 'APPROVED', sourceRawRecipeCandidate: toast },
  ]) as typeof originals.meals;
  prisma.mealLibrary.count = (async () => 1) as typeof originals.count;
  prisma.rawRecipeCandidate.findMany = (async () => [toast]) as typeof originals.raw;
  context.after(() => {
    prisma.mealLibrary.findMany = originals.meals;
    prisma.mealLibrary.count = originals.count;
    prisma.rawRecipeCandidate.findMany = originals.raw;
  });
  const result = await AdminMealImageService.list(1, 18, 'French Toast');
  assert.deepEqual(result.items[0].image, toPublicRawRecipeImage(toast));
  assert.equal(result.items[0].hasImage, false);
});

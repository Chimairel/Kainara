import assert from 'node:assert/strict';
import test from 'node:test';
import { batchMealImageSchema, batchMealImageUrlSchema } from '../src/validation/batch-meal-image.schemas';
import { batchMealImageFields, exportBatchMealImage } from '../src/domain/batch-meal-image.policy';
import { toPublicMealImage, type MealImageRecord } from '../src/domain/meal-image.policy';

const image = {
  url: 'https://res.cloudinary.com/example/image/upload/v123/test/chicken.jpg',
  imageKind: 'REPRESENTATIVE' as const,
  altText: 'A plate of chicken and white rice',
  creator: 'Test photographer',
  sourcePageUrl: 'https://example.com/chicken-photo',
  licenseCode: null,
};
const empty: MealImageRecord = {
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

test('batch photo accepts existing image providers and rejects unsupported/private URLs', () => {
  assert(batchMealImageSchema.safeParse(image).success);
  assert(batchMealImageUrlSchema.safeParse('https://panlasangpinoy.com/wp-content/uploads/a.jpg').success);
  assert(batchMealImageUrlSchema.safeParse('https://i.ytimg.com/vi/uXi6QDOdhGg/mqdefault.jpg').success);
  for (const url of [
    'not a URL',
    'http://res.cloudinary.com/a/image/upload/b.jpg',
    'https://localhost/image.jpg',
    'https://127.0.0.1/a.jpg',
    'https://example.com/a.jpg',
    'https://res.cloudinary.com.evil.example/a.jpg',
    'https://user:password@res.cloudinary.com/a/image/upload/b.jpg',
    'https://res.cloudinary.com/a/video/upload/b.mp4',
    'https://res.cloudinary.com/a/image/fetch/https://example.com/a.jpg',
    'https://panlasangpinoy.com/recipe/',
    'https://res.cloudinary.com:444/a/image/upload/b.jpg',
    'data:image/png;base64,YQ==',
    'javascript:alert(1)',
  ])
    assert.equal(batchMealImageUrlSchema.safeParse(url).success, false, url);
});

test('photo provenance retains unknown license honestly and validates claimed licenses', () => {
  assert.equal(batchMealImageSchema.safeParse({ ...image, creator: undefined }).success, false);
  assert.equal(batchMealImageSchema.safeParse({ ...image, sourcePageUrl: undefined }).success, false);
  assert.equal(batchMealImageSchema.safeParse({ ...image, licenseUrl: 'https://example.com/license' }).success, false);
  assert.equal(batchMealImageSchema.safeParse({ ...image, licenseCode: 'CC_BY_4_0' }).success, false);
  assert(
    batchMealImageSchema.safeParse({
      ...image,
      licenseCode: 'CC_BY_4_0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    }).success
  );
  assert(
    batchMealImageSchema.safeParse({ url: image.url, imageKind: 'EXACT', altText: image.altText, licenseCode: 'OWNED' })
      .success
  );
  assert.equal(batchMealImageSchema.safeParse({ ...image, verifiedByNutritionistId: 'invented' }).success, false);
  assert.equal(batchMealImageSchema.safeParse({ ...image, sourcePageUrl: 'javascript:alert(1)' }).success, false);
});

test('linked image uses existing columns and preserves type, attribution and export without reviewer fabrication', () => {
  const fields = batchMealImageFields(image);
  assert(fields.imageAssignedAt instanceof Date);
  const record = { ...empty, ...fields, mealName: 'Chicken bowl' };
  assert.deepEqual(toPublicMealImage(record), {
    url: image.url,
    altText: image.altText,
    kind: 'REPRESENTATIVE',
    attribution: {
      creator: image.creator,
      sourcePageUrl: image.sourcePageUrl,
      licenseCode: null,
      licenseUrl: null,
      modifications: null,
    },
  });
  assert.deepEqual(exportBatchMealImage(record), image);
  assert.equal(exportBatchMealImage(empty), null);
  assert.equal(
    exportBatchMealImage(empty, {
      url: 'https://panlasangpinoy.com/wp-content/uploads/rice.jpg',
      altText: 'A recorded source recipe photo',
      kind: 'EXACT',
      attribution: {
        creator: 'Panlasang Pinoy',
        sourcePageUrl: 'https://panlasangpinoy.com/rice/',
        licenseCode: null,
        licenseUrl: null,
        modifications: null,
      },
    })?.creator,
    'Panlasang Pinoy'
  );
  assert.equal(exportBatchMealImage({ ...record, adaptedImageUrl: 'https://example.com/not-supported.jpg' }), null);
  assert.equal('verifiedByNutritionistId' in fields, false);
});

test('legacy adapted recipes retain their existing default presentation', () => {
  assert.deepEqual(toPublicMealImage({ ...empty, adaptedImageUrl: image.url, mealName: 'Adapted bowl' }), {
    url: image.url,
    altText: 'Adapted bowl',
    kind: 'EXACT',
    attribution: {
      creator: 'Nutritionist supplied',
      sourcePageUrl: null,
      licenseCode: null,
      licenseUrl: null,
      modifications: 'Adapted recipe',
    },
  });
});

/** Real HTTP/SQL acceptance; refuses every shared, staging and demo database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.equal(target.pathname, '/kainara_batch_image_acceptance_20261017');
  assert.equal(process.env.DIRECT_URL, process.env.DATABASE_URL);
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'CLOUDINARY_URL', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  const { default: db } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } = await import('../src/domain/onboarding.policy');
  const { toPublicMealImage } = await import('../src/domain/meal-image.policy');
  const { digest } = await import('../src/services/meal-review-context.service');
  assert.equal(await db.user.count(), 0, 'Use a fresh disposable fixture.');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(String(input)).hostname, '127.0.0.1');
    return originalFetch(input, init);
  };
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const run = randomUUID();
  const account = (role: 'ADMIN' | 'USER', label: string) =>
    db.user.create({
      data: {
        email: `${run}-${label}@example.invalid`,
        name: `Synthetic ${label}`,
        role,
        passwordHash: 'NOT_A_LOGIN',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      },
    });
  const request = async (
    user: Awaited<ReturnType<typeof account>>,
    path: string,
    body?: unknown,
    method = body ? 'POST' : 'GET'
  ) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${signAccessToken({ userId: user.id, email: user.email, role: user.role })}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: (await res.json()) as { data: any; error?: string } };
  };
  const ok = async (response: ReturnType<typeof request>) => {
    const r = await response;
    assert.equal(r.status, 200, JSON.stringify(r.body));
    return r.body.data;
  };
  try {
    const admin = await account('ADMIN', 'admin'),
      other = await account('ADMIN', 'other'),
      member = await account('USER', 'member');
    const food = await db.foodItem.create({
      data: { name: 'Synthetic FNRI rice', source: 'FNRI', calories: 100, proteinG: 1, carbsG: 20, fatG: 1 },
    });
    const image = {
      url: 'https://res.cloudinary.com/fixture/image/upload/v1/rice.jpg',
      imageKind: 'REPRESENTATIVE',
      altText: 'Synthetic rice meal image',
      creator: 'Synthetic photographer',
      licenseCode: 'OWNED',
    };
    const meal = {
      mealName: 'Synthetic image batch one',
      mealType: 'LUNCH',
      summary: 'Synthetic measured recipe for a provider-free test.',
      instructions: 'Measure the edible serving and cook fully before serving.',
      nutritionBasis: 'Synthetic per-serving nutrition for import verification only.',
      nutritionServingDescription: 'One 100 g serving',
      calories: 100,
      proteinG: 1,
      carbsG: 20,
      fatG: 1,
      sodiumMg: null,
      sugarG: null,
      fiberG: null,
      potassiumMg: null,
      phosphorusMg: null,
      saturatedFatG: null,
      ingredients: [{ foodItemId: food.id, gramsPerServing: 100 }],
    };
    const payload = {
      format: 'KAINARA_MEALS_V1',
      meals: [
        { ...meal, image },
        {
          ...meal,
          mealName: 'Synthetic image batch two',
          image: {
            ...image,
            url: 'https://panlasangpinoy.com/wp-content/uploads/test.jpg',
            licenseCode: null,
            creator: 'Synthetic source',
            sourcePageUrl: 'https://panlasangpinoy.com/test/',
          },
        },
      ],
    };
    assert.equal((await request(member, '/admin/meals/batch/preview', payload)).status, 403);
    const invalid = await ok(
      request(admin, '/admin/meals/batch/preview', {
        ...payload,
        meals: [{ ...meal, image: { ...image, url: 'not a URL' } }],
      })
    );
    assert.equal(invalid.valid, false);
    assert(invalid.results[0].errors.some((e: string) => e.startsWith('image.url')));
    assert.equal(await db.mealLibrary.count(), 0);
    const preview = await ok(request(admin, '/admin/meals/batch/preview', payload));
    assert.equal(preview.valid, true);
    assert.equal((await request(other, '/admin/meals/batch/import', { previewId: preview.previewId })).status, 404);
    const imports = await Promise.all([
      ok(request(admin, '/admin/meals/batch/import', { previewId: preview.previewId })),
      ok(request(admin, '/admin/meals/batch/import', { previewId: preview.previewId })),
    ]);
    assert.equal(imports.filter((r) => r.replayed).length, 1);
    const ids = imports[0].meals.map((m: { id: string }) => m.id);
    assert.equal(await db.mealLibrary.count(), 2);
    for (const [index, id] of ids.entries()) {
      const row = await db.mealLibrary.findUniqueOrThrow({ where: { id } });
      assert.equal(row.adaptedImageUrl, payload.meals[index].image.url);
      assert.equal(row.imagePublicId, null);
      assert.equal(row.safetyEvidenceStatus, 'INCOMPLETE');
      assert.equal(row.verifiedByNutritionistId, null);
      assert.equal(row.safetyReviewedByNutritionistId, null);
      assert.equal(toPublicMealImage(row)?.kind, 'REPRESENTATIVE');
      assert.equal(toPublicMealImage(row)?.attribution.creator, payload.meals[index].image.creator);
    }
    assert.equal(await db.auditEvent.count({ where: { action: 'MEAL_IMAGE_LINKED' } }), 2);
    const exported = await ok(request(admin, '/admin/meals/batch/export', { ids }));
    assert.deepEqual(
      exported.meals.map((m: { image: unknown }) => m.image),
      payload.meals.map((m) => m.image)
    );
    assert.equal((await ok(request(admin, '/admin/meals/batch/preview', exported))).alreadyImported, true);
    const changedImage = await ok(
      request(admin, '/admin/meals/batch/preview', {
        ...payload,
        meals: [{ ...payload.meals[0], image: { ...image, altText: 'A different description only' } }],
      })
    );
    assert.equal(changedImage.valid, false);
    assert.equal(await db.mealLibrary.count(), 2);
    const legacy = { format: 'KAINARA_MEALS_V1', meals: [{ ...meal, mealName: 'Synthetic image-free legacy' }] };
    const legacyPreview = await ok(request(admin, '/admin/meals/batch/preview', legacy));
    const legacyResult = await ok(request(admin, '/admin/meals/batch/import', { previewId: legacyPreview.previewId }));
    const legacyExport = await ok(request(admin, '/admin/meals/batch/export', { ids: [legacyResult.meals[0].id] }));
    assert.equal('image' in legacyExport.meals[0], false);
    assert.equal((await ok(request(admin, '/admin/meals/batch/preview', legacyExport))).alreadyImported, true);
    await db.mealBatchImport.update({ where: { id: legacyPreview.previewId }, data: { payloadHash: digest(legacy) } });
    assert.equal((await ok(request(admin, '/admin/meals/batch/preview', legacy))).alreadyImported, true);
    await assert.rejects(
      db.mealLibrary.update({ where: { id: ids[1] }, data: { imageCreator: null, imageLicenseCode: null } })
    );
    assert.equal((await db.mealLibrary.findUniqueOrThrow({ where: { id: ids[1] } })).imageCreator, 'Synthetic source');
    const { AdminMealImageService } = await import('../src/services/admin-meal-image.service');
    await AdminMealImageService.unassign(admin.id, ids[0]);
    assert.equal(toPublicMealImage(await db.mealLibrary.findUniqueOrThrow({ where: { id: ids[0] } })), null);
    assert.equal(await db.aiUsageEvent.count(), 0);
    console.log(
      JSON.stringify({
        result: 'PASS',
        realHttpSql: true,
        mealsCreated: 3,
        imageImports: 2,
        duplicateRetry: true,
        exportRoundTrip: true,
        legacyRoundTrip: true,
        imageRemoval: true,
        invalidUrlRejected: true,
        roleOwnerGuards: true,
        providerCalls: 0,
        demoRequests: 0,
      })
    );
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

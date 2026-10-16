import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.equal(target.pathname, '/kainara_recipe_batch_acceptance');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'CLOUDINARY_URL', 'BREVO_API_KEY', 'SMTP_PASS', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] || '', '', 'Real provider credentials are forbidden in this fixture.');
  const { default: prisma } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { VerifiedRecipeCatalogService } = await import('../src/services/verified-recipe-catalog.service');
  const { recordedRecipeReviewers } = await import('../src/services/recorded-recipe-reviewer.service');
  const { recipeReviewEvidenceHash } = await import('../src/domain/recipe-batch-review.policy');
  const { rawBaseVerificationEvidence } = await import('../src/services/meal-base-verification.service');
  const run = randomUUID();
  const member = await prisma.user.create({
    data: {
      name: 'Synthetic member',
      email: `${run}-member@example.test`,
      passwordHash: 'not-a-login',
      role: 'USER',
      emailVerified: true,
      userProfile: { create: { age: 30, weightKg: 60, dailyCalorieTarget: 1800 } },
    },
  });
  async function reviewer(label: string, expires = '2099-01-01') {
    return prisma.user.create({
      data: {
        name: label,
        email: `${run}-${label}@example.test`,
        passwordHash: 'not-a-login',
        role: 'NUTRITIONIST',
        emailVerified: true,
        nutritionistProfile: {
          create: { isVerified: true, prcLicenseNumber: `${run}-${label}`, prcLicenseExpiry: new Date(expires) },
        },
      },
      include: { nutritionistProfile: true },
    });
  }
  const rnd = await reviewer('reviewer'),
    other = await reviewer('other'),
    expired = await reviewer('expired', '2020-01-01');
  const source = await prisma.rawRecipeCandidate.create({
    data: {
      sourceRecordId: `${run}-source`,
      sourceUrl: 'https://panlasangpinoy.com/fixture',
      recipeName: 'Synthetic steamed fish',
      normalizedName: 'synthetic steamed fish',
      contentSignature: randomUUID(),
      mealType: 'LUNCH',
      description: 'Steam until cooked; divide into the recorded serving.',
      cuisines: [],
      dietaryTags: [],
      ingredients: [{ name: 'Fish', quantity: 100, unit: 'g' }],
      publishedNutrition: { basis: 'source serving' },
      calories: 100,
      proteinG: 20,
      carbsG: 0,
      fatG: 2,
    },
  });
  const incomplete = await prisma.rawRecipeCandidate.create({
    data: {
      sourceRecordId: `${run}-incomplete`,
      sourceUrl: 'https://panlasangpinoy.com/fixture-incomplete',
      recipeName: 'Synthetic incomplete source',
      normalizedName: 'synthetic incomplete source',
      contentSignature: randomUUID(),
      mealType: 'LUNCH',
      description: 'Preparation',
      cuisines: [],
      dietaryTags: [],
      ingredients: [],
      calories: null,
    },
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api/nutritionist/recipe-batch-review`;
  const token = (user: typeof member) => signAccessToken({ userId: user.id, email: user.email, role: user.role });
  const headers = (user: typeof member) => ({
    Authorization: `Bearer ${token(user)}`,
    'Content-Type': 'application/json',
  });
  const checks: string[] = [];
  try {
    assert.equal((await fetch(`${base}/preview`)).status, 401);
    assert.equal((await fetch(`${base}/preview`, { headers: headers(member) })).status, 403);
    assert.equal((await fetch(`${base}/preview`, { headers: headers(expired) })).status, 403);
    checks.push('Unauthenticated, member and expired RND access rejected');
    assert.equal((await VerifiedRecipeCatalogService.list(member.id, { summaryOnly: true })).total, 0);
    const preview = (await (await fetch(`${base}/preview`, { headers: headers(rnd) })).json()) as any;
    assert.equal(preview.success, true);
    const item = preview.data.items.find((row: any) => row.id === source.id);
    assert.equal(item.reviewed, false);
    assert.ok(preview.data.items.find((row: any) => row.id === incomplete.id).issues.length);
    assert.equal(
      await prisma.mealBaseVerification.count({ where: { targetId: { in: [source.id, incomplete.id] } } }),
      0
    );
    checks.push('Export is read-only, has evidence issues and creates no approval');
    const payload = {
      confirmedReview: true,
      environmentKey: preview.data.environmentKey,
      items: [
        {
          id: item.id,
          revisionKey: item.revisionKey,
          evidenceHash: item.evidenceHash,
          rationale: 'Synthetic fixture review of ingredients and serving.',
        },
      ],
    };
    const submit = async (body: unknown) => {
      const response = await fetch(`${base}/confirm`, {
        method: 'POST',
        headers: headers(rnd),
        body: JSON.stringify(body),
      });
      return { status: response.status, body: (await response.json()) as any };
    };
    assert.equal((await submit({ ...payload, confirmedReview: false })).status, 400);
    assert.equal((await submit({ ...payload, environmentKey: '0'.repeat(64) })).status, 409);
    const stale = await submit({ ...payload, items: [{ ...payload.items[0], evidenceHash: '0'.repeat(64) }] });
    assert.equal(stale.body.data.results[0].status, 'FAILED');
    assert.equal(
      await prisma.mealBaseVerification.count({ where: { targetId: { in: [source.id, incomplete.id] } } }),
      0
    );
    checks.push('Explicit confirmation, database-target binding and stale-evidence guard enforced');
    const { MealBaseVerificationService } = await import('../src/services/meal-base-verification.service');
    await MealBaseVerificationService.claim(other.nutritionistProfile!.id, 'RAW_RECIPE', source.id);
    assert.equal((await submit(payload)).body.data.results[0].status, 'FAILED');
    await MealBaseVerificationService.release(other.nutritionistProfile!.id, 'RAW_RECIPE', source.id);
    checks.push('Competing RND claim preserved');
    assert.equal((await submit(payload)).body.data.results[0].status, 'VERIFIED');
    assert.equal((await submit(payload)).body.data.results[0].status, 'ALREADY_VERIFIED');
    const record = await prisma.mealBaseVerification.findFirstOrThrow({ where: { targetId: source.id } });
    assert.equal(record.reviewedByNutritionistId, rnd.nutritionistProfile!.id);
    assert.equal(await prisma.auditEvent.count({ where: { action: 'BASE_MEAL_VERIFIED', entityId: source.id } }), 1);
    assert.equal((await VerifiedRecipeCatalogService.list(member.id, { summaryOnly: true })).total, 1);
    const verifiers = await recordedRecipeReviewers([
      { sourceRawRecipeCandidate: { id: source.id, contentSignature: source.contentSignature } },
    ]);
    assert.equal(verifiers.get(source.id)?.name, rnd.name);
    checks.push('One audited review, idempotent retry, correct catalogue count and reviewer');
    const bad = rawBaseVerificationEvidence(incomplete);
    assert.equal(
      (
        await submit({
          confirmedReview: true,
          environmentKey: preview.data.environmentKey,
          items: [
            {
              id: incomplete.id,
              revisionKey: incomplete.contentSignature,
              evidenceHash: recipeReviewEvidenceHash(bad),
              rationale: 'Synthetic blocked review attempt.',
            },
          ],
        })
      ).body.data.results[0].status,
      'FAILED'
    );
    await prisma.rawRecipeCandidate.update({ where: { id: source.id }, data: { contentSignature: randomUUID() } });
    assert.equal((await VerifiedRecipeCatalogService.list(member.id, { summaryOnly: true })).total, 0);
    assert.equal((await submit(payload)).body.data.results[0].status, 'FAILED');
    checks.push('Incomplete evidence and changed revisions remain unpublished');
    console.log(
      JSON.stringify({ target: 'loopback disposable recipe-batch fixture', checks, passed: checks.length }, null, 2)
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Acceptance failed');
  process.exitCode = 1;
});

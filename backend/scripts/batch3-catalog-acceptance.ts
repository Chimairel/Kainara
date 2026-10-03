import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import prisma from '../src/lib/prisma';
import { panlasangRecipeCandidateProvider } from '../src/services/panlasang-recipe-candidate.provider';
import { queryEligibleLibraryPage } from '../src/services/meal-library-candidate-query.service';

async function main() {
  const run = randomUUID();
  const emailA = `batch3-a-${run}@example.invalid`;
  let userAId: string | null = null;
  let mealId: string | null = null;

  try {
    const [rawAvailable, rawDistinct, rawApplicability, libraryCount, libraryApplicability] = await Promise.all([
      prisma.rawRecipeCandidate.count({ where: { status: 'AVAILABLE' } }),
      prisma.rawRecipeCandidate.groupBy({ by: ['contentSignature'], where: { status: 'AVAILABLE' } }),
      prisma.rawRecipeApplicableType.count(),
      prisma.mealLibrary.count(),
      prisma.mealLibraryApplicableType.count(),
    ]);
    assert.equal(rawAvailable, 1960);
    assert.equal(rawDistinct.length, rawAvailable);
    assert.ok(rawApplicability >= rawAvailable);
    assert.ok(libraryApplicability >= libraryCount);

    const first = await panlasangRecipeCandidateProvider.list({ limit: 12 });
    assert.equal(first.items.length, 12);
    assert.ok(first.nextCursor);
    assert.ok(first.items.every((item) => item.provenance === 'PANLASANG_PINOY'));
    assert.ok(first.items.every((item) => item.applicableMealTypes.length > 0));
    const sorted = [...first.items].sort(
      (left, right) => left.normalizedName.localeCompare(right.normalizedName) || left.id.localeCompare(right.id)
    );
    assert.deepEqual(
      first.items.map((item) => item.id),
      sorted.map((item) => item.id)
    );
    const second = await panlasangRecipeCandidateProvider.list({ limit: 12, cursor: first.nextCursor! });
    assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 24);

    const catalogProfile = {
      userId: `batch3-catalog-${run}`,
      dietaryPreference: 'OMNIVORE' as const,
      otherConditions: null,
      otherAllergies: null,
    };
    const eligibleFirst = await queryEligibleLibraryPage({
      userId: catalogProfile.userId,
      userConditions: [],
      userAllergens: [],
      profile: catalogProfile,
      limit: 5,
    });
    assert.ok(eligibleFirst.total >= eligibleFirst.items.length);
    if (eligibleFirst.nextCursor) {
      const eligibleSecond = await queryEligibleLibraryPage({
        userId: catalogProfile.userId,
        userConditions: [],
        userAllergens: [],
        profile: catalogProfile,
        cursor: eligibleFirst.nextCursor,
        limit: 5,
      });
      assert.equal(eligibleSecond.total, eligibleFirst.total);
      assert.equal(
        new Set([...eligibleFirst.items, ...eligibleSecond.items].map((item) => item.id)).size,
        eligibleFirst.items.length + eligibleSecond.items.length
      );
    }

    const userA = await prisma.user.create({
      data: { name: 'Batch 3 User A', email: emailA, passwordHash: 'disabled', emailVerified: true },
    });
    userAId = userA.id;
    const meal = await prisma.mealLibrary.create({
      data: {
        mealName: `Batch 3 catalog ${run}`,
        mealType: 'LUNCH',
        calories: 500,
        proteinG: 25,
        carbsG: 50,
        fatG: 20,
        dietaryTags: ['OMNIVORE'],
        applicableMealTypes: {
          create: [
            { mealType: 'LUNCH', source: 'NUTRITIONIST_REVIEW', reviewStatus: 'REVIEWED' },
            { mealType: 'DINNER', source: 'NUTRITIONIST_REVIEW', reviewStatus: 'REVIEWED' },
          ],
        },
      },
    });
    mealId = meal.id;
    await prisma.mealLibrary.update({ where: { id: meal.id }, data: { status: 'FLAGGED' } });
    const eligible = await queryEligibleLibraryPage({
      userId: userA.id,
      mealType: 'LUNCH',
      userConditions: [],
      userAllergens: [],
      profile: { userId: userA.id, dietaryPreference: null, otherConditions: null, otherAllergies: null },
      search: run,
      limit: 10,
    });
    assert.equal(eligible.total, 0);
    assert.deepEqual(eligible.items, []);

    await prisma.user.delete({ where: { id: userA.id } });
    userAId = null;

    console.log(
      JSON.stringify(
        {
          rawAvailable,
          rawDistinctSignatures: rawDistinct.length,
          rawApplicability,
          libraryCount,
          libraryApplicability,
          providerPagination: 'PASS',
          eligibleLibraryPagination: {
            total: eligibleFirst.total,
            firstPage: eligibleFirst.items.length,
            status: 'PASS',
          },
          flaggedMealExcluded: 'PASS',
        },
        null,
        2
      )
    );
  } finally {
    if (userAId) await prisma.user.deleteMany({ where: { id: userAId } });
    if (mealId) await prisma.mealLibrary.deleteMany({ where: { id: mealId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

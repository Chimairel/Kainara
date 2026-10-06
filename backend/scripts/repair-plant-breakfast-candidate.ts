import 'dotenv/config';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { Prisma, PrismaClient } from '@prisma/client';
import { classifyMealIngredients } from '../src/domain/meal-ingredient-classification.policy';

// Published recipe checked 2026-10-07. Correct metadata only, never ingredients,
// servings, published nutrients, safety declarations or reviewer decisions.
const sourceUrl = 'https://panlasangpinoy.com/filipino-street-food-homemade-taho-recipe/';
const expectedNames = ['soft silken tofu', 'sago pearls (Note 1)', 'water', 'brown sugar', 'water', 'vanilla extract'];
const target = new URL(process.env.DATABASE_URL || '');
const local = target.hostname === '127.0.0.1' && target.port === '55480' && target.pathname === '/kainara_meal_preview';
const development =
  target.hostname === 'ep-crimson-poetry-ao0sqrvy-pooler.c-2.ap-southeast-1.aws.neon.tech' &&
  target.pathname === '/neondb';
assert.ok(local || development, 'Only the exact preview fixture or development catalogue is permitted.');
const apply = process.argv.includes('--apply');
assert.ok(
  !apply || process.env.PLANT_BREAKFAST_REPAIR_TARGET === (local ? 'preview-fixture' : 'development-catalogue'),
  'Explicit target is required for apply.'
);
const db = new PrismaClient();

async function main() {
  const result = await db.$transaction(
    async (tx) => {
      if (!apply) await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      else await tx.$executeRaw`SELECT pg_advisory_xact_lock(741010)`;
      const source = await tx.rawRecipeCandidate.findFirstOrThrow({
        where: { sourceName: 'PANLASANG_PINOY', sourceUrl, status: 'AVAILABLE', recipeName: 'Homemade Taho' },
        include: { applicableMealTypes: true },
      });
      assert.equal(await tx.rawRecipeCandidate.count({ where: { sourceUrl } }), 1);
      assert.ok(source.applicableMealTypes.some((t) => t.mealType === 'BREAKFAST'));
      const ingredients = source.ingredients as Array<{ name: string; quantity: number; unit: string }>;
      assert.deepEqual(
        ingredients.map((i) => i.name),
        expectedNames
      );
      assert.deepEqual(
        ingredients.map((i) => i.quantity),
        [7.33, 0.25, 1.5, 0.25, 0.25, 0.33]
      );
      assert.deepEqual([source.calories, source.proteinG, source.carbsG, source.fatG], [605, 18, 114, 9]);
      assert.equal(source.originalServings, 3);
      const classification = classifyMealIngredients(ingredients);
      assert.equal(classification.status, 'COMPLETE');
      assert.ok(classification.compatibleDietaryPreferences.includes('VEGAN'));
      const tags = classification.compatibleDietaryPreferences;
      const changed = JSON.stringify(source.dietaryTags) !== JSON.stringify(tags) || source.riceRole !== 'STANDALONE';
      if (apply && changed) {
        const saved = await tx.rawRecipeCandidate.updateMany({
          where: { id: source.id, updatedAt: source.updatedAt, contentSignature: source.contentSignature },
          data: { dietaryTags: tags, riceRole: 'STANDALONE', riceRoleReviewStatus: 'PROPOSED' },
        });
        assert.equal(saved.count, 1, 'Concurrent source edit; retry dry-run.');
        const after = await tx.rawRecipeCandidate.findUniqueOrThrow({ where: { id: source.id } });
        assert.deepEqual(after.ingredients, source.ingredients);
        assert.deepEqual(after.publishedNutrition, source.publishedNutrition);
        assert.equal(after.contentSignature, source.contentSignature);
      }
      // User-authorized slot proposals for unchanged plant plates. These labels
      // are not publisher breakfast claims or clinical approvals. Sinangag's
      // breakfast use is explicit in its source; tofu/spinach are proposed ulam.
      const plates = [
        {
          name: 'Sinangag Recipe (Filipino Fried Rice)',
          url: 'https://panlasangpinoy.com/sinangag-recipe/',
          nutrition: [311, 4, 45, 12],
          role: 'INCLUDES_RICE' as const,
        },
        {
          name: 'Sweet and Sour Tofu',
          url: 'https://panlasangpinoy.com/sweet-and-sour-tofu-recipe/',
          nutrition: [434, 10, 57, 19],
          role: 'PAIR_WITH_RICE' as const,
        },
        {
          name: 'Sauteed Spinach',
          url: 'https://panlasangpinoy.com/sauteed-spinach/',
          nutrition: [450, 9, 13, 43],
          role: 'PAIR_WITH_RICE' as const,
        },
      ];
      const proposals = [];
      for (const plate of plates) {
        const row = await tx.rawRecipeCandidate.findFirstOrThrow({
          where: { sourceName: 'PANLASANG_PINOY', sourceUrl: plate.url, recipeName: plate.name, status: 'AVAILABLE' },
          include: { applicableMealTypes: true },
        });
        assert.equal(await tx.rawRecipeCandidate.count({ where: { sourceUrl: plate.url } }), 1);
        assert.deepEqual([row.calories, row.proteinG, row.carbsG, row.fatG], plate.nutrition);
        assert.ok(
          classifyMealIngredients(row.ingredients as Array<{ name: string }>).compatibleDietaryPreferences.includes(
            'VEGAN'
          )
        );
        const addBreakfast = !row.applicableMealTypes.some((t) => t.mealType === 'BREAKFAST');
        if (apply && (addBreakfast || row.riceRole !== plate.role)) {
          assert.equal(
            (
              await tx.rawRecipeCandidate.updateMany({
                where: { id: row.id, updatedAt: row.updatedAt, contentSignature: row.contentSignature },
                data: { riceRole: plate.role, riceRoleReviewStatus: 'PROPOSED' },
              })
            ).count,
            1
          );
          if (addBreakfast)
            await tx.rawRecipeApplicableType.create({
              data: {
                rawRecipeCandidateId: row.id,
                mealType: 'BREAKFAST',
                source: 'DETERMINISTIC_CLASSIFIER',
                reviewStatus: 'PROPOSED',
              },
            });
          const after = await tx.rawRecipeCandidate.findUniqueOrThrow({ where: { id: row.id } });
          assert.deepEqual(after.ingredients, row.ingredients);
          assert.deepEqual(after.publishedNutrition, row.publishedNutrition);
          assert.equal(after.contentSignature, row.contentSignature);
        }
        proposals.push({
          sourceId: row.id,
          sourceUrl: plate.url,
          addBreakfast,
          beforeRiceRole: row.riceRole,
          afterRiceRole: plate.role,
        });
      }
      return {
        target: local ? 'preview-fixture' : 'development-catalogue',
        mode: apply ? 'apply' : 'dry-run',
        sourceId: source.id,
        sourceUrl,
        changed,
        beforeTags: source.dietaryTags,
        afterTags: tags,
        beforeRiceRole: source.riceRole,
        afterRiceRole: 'STANDALONE',
        basis:
          'Published breakfast recipe; sago pearls and vanilla extract are recognized plant ingredients. Ingredient compatibility is not allergen absence/cross-contact clearance.',
        proposals,
        ingredientAndNutritionChanges: 0,
        safetyApprovalsGranted: 0,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 }
  );
  await mkdir('../.codex-runtime/meal-preview-audit', { recursive: true });
  await writeFile(
    `../.codex-runtime/meal-preview-audit/plant-breakfast-${result.target}-${result.mode}.json`,
    JSON.stringify(result, null, 2)
  );
  console.log(JSON.stringify(result));
}
main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });

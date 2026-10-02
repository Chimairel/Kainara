import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { MANAGED_CATALOGUE_REVIEW_REASONS } from '@/domain/catalogue-population.policy';
import { getManilaDateKey, getManilaMidnight } from '@/domain/meal-plan-cycle.policy';

export const fixtureCatalogueWhere: Prisma.MealLibraryWhereInput = {
  sourceRawRecipeCandidateId: null,
  safetyReviews: { some: { reasonCode: { in: [...MANAGED_CATALOGUE_REVIEW_REASONS] } } },
};

/** Remove fixture recipes from active use while preserving referenced history. */
export async function retireFixtureCatalogue() {
  return prisma.$transaction(
    async (tx) => {
      const rows = await tx.mealLibrary.findMany({
        where: { ...fixtureCatalogueWhere, status: { not: 'ARCHIVED' } },
        select: { id: true },
      });
      const ids = rows.map((row) => row.id);
      if (!ids.length) return { archivedRecipes: 0, affectedPlans: 0, affectedUsers: 0 };
      const now = new Date();
      const activePlans = await tx.mealPlan.findMany({
        where: {
          libraryMealId: { in: ids },
          scheduledDate: { gte: getManilaMidnight(getManilaDateKey(now)) },
          status: 'APPROVED',
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      const users = activePlans.map((plan) => plan.userId);
      await tx.mealLibrary.updateMany({
        where: { id: { in: ids } },
        data: {
          status: 'ARCHIVED',
          safetyEvidenceStatus: 'STALE',
          safetyInvalidatedAt: now,
          safetyInvalidationReason: 'SEEDED_FIXTURE_RETIRED',
        },
      });
      const plans = await tx.mealPlan.updateMany({
        where: { libraryMealId: { in: ids }, status: 'APPROVED', requiresSafetyRevalidation: false },
        data: { requiresSafetyRevalidation: true },
      });
      if (users.length) {
        await tx.groceryList.updateMany({ where: { userId: { in: users } }, data: { isStale: true } });
        await tx.notification.createMany({
          data: users.map((userId) => ({
            userId,
            type: 'MEAL_FLAGGED',
            title: 'A meal in your plan was retired',
            message:
              'An older test recipe was removed from the catalogue. Your affected meal needs replacement with a reviewed recipe.',
          })),
        });
      }
      await tx.auditEvent.create({
        data: {
          action: 'FIXTURE_MEAL_CATALOGUE_RETIRED',
          entityType: 'MealLibrary',
          metadata: { authorizedBy: 'owner', recipeIds: ids, affectedPlans: plans.count, affectedUsers: users.length },
        },
      });
      return { archivedRecipes: ids.length, affectedPlans: plans.count, affectedUsers: users.length };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }
  );
}

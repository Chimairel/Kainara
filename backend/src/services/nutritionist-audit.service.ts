import prisma from '@/lib/prisma';
import { StaffAuditService } from './staff-audit.service';
import { recipeFamilyWhere } from './meal-recipe-family.service';
import { AppError } from '@/errors/AppError';

export class NutritionistAuditService {
  static async recipeCases(mealId: string, page: number, db = prisma) {
    const variants = await db.mealLibrary.findMany({
      where: await recipeFamilyWhere(db, mealId), select: { id: true, sourceRawRecipeCandidateId: true },
    });
    if (!variants.length) throw new AppError('Meal not found.', 404, 'MEAL_NOT_FOUND');
    return StaffAuditService.history({ view: 'nutritionist', page, limit: 10,
      recipeCase: { libraryIds: variants.map(({ id }) => id), sourceId: variants.find((row) => row.sourceRawRecipeCandidateId)?.sourceRawRecipeCandidateId ?? null } }, db);
  }
  static async history(page: number, limit: number, db = prisma, actorId?: string) {
    const result = await StaffAuditService.history(
      { view: 'nutritionist', page, limit, includeAdminMealFlags: true, actorId },
      db
    );
    return { ...result, rows: result.rows.map((row) => ({ ...row, nutritionist: row.actor })) };
  }
}

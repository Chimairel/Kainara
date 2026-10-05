import prisma from '@/lib/prisma';
import { StaffAuditService } from './staff-audit.service';

export class NutritionistAuditService {
  static async history(page: number, limit: number, db = prisma, actorId?: string) {
    const result = await StaffAuditService.history(
      { view: 'nutritionist', page, limit, includeAdminMealFlags: true, actorId },
      db
    );
    return { ...result, rows: result.rows.map((row) => ({ ...row, nutritionist: row.actor })) };
  }
}

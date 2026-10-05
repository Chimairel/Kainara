import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { auditFacts, auditFood, auditNutrition, auditObject } from '@/domain/audit-details.policy';
import { StaffAuditService } from './staff-audit.service';

export class AuditDetailsService {
  static async detail(id: string, view: 'admin' | 'nutritionist', db = prisma) {
    // Reuse history visibility, including legacy attribution and only public admin meal flags for RNDs.
    const visible = await StaffAuditService.history(
      {
        view,
        recordId: id,
        relatedTo: view === 'admin' ? id : undefined,
        includeAdminMealFlags: view === 'nutritionist',
        limit: 1,
      },
      db
    );
    const record = visible.rows[0];
    if (!record) throw new AppError('This audit record is unavailable.', 404, 'AUDIT_RECORD_NOT_FOUND');
    if (id.startsWith('flag:')) {
      const flag = await db.mealLibraryFlag.findUnique({ where: { id: id.slice(5) }, select: { reason: true } });
      if (!flag) throw new AppError('This audit record is unavailable.', 404, 'AUDIT_RECORD_NOT_FOUND');
      return { record, facts: [], reason: flag.reason.slice(0, 1000), food: null, previous: null, effective: null };
    }
    const event = await db.auditEvent.findUnique({
      where: { id },
      select: { metadata: true, entityType: true, entityId: true, action: true },
    });
    if (!event) throw new AppError('This audit record is unavailable.', 404, 'AUDIT_RECORD_NOT_FOUND');
    const metadata = auditObject(event.metadata);
    const outside = event.entityType === 'OutsideMealLogItem' && event.action.startsWith('OUTSIDE_MEAL_');
    const baseMeal = /^BASE_MEAL_(VERIFIED|REJECTED)$/.test(event.action);
    let snapshot: unknown = outside || baseMeal ? metadata.food : null;
    // Legacy events: select their exact saved revision, never the current mutable item.
    if (outside && !snapshot && event.entityId && Number.isInteger(metadata.revision)) {
      const revision = await db.outsideMealItemRevision.findUnique({
        where: {
          outsideMealLogItemId_revision: {
            outsideMealLogItemId: event.entityId,
            revision: metadata.revision as number,
          },
        },
        select: { snapshot: true },
      });
      snapshot = revision?.snapshot;
    }
    const mealFlag = /^(MEAL_BASE_FLAGGED|MEAL_LIBRARY_FLAGGED|MEAL_BASE_FLAG_RELEASED)$/.test(event.action);
    // Clinical-profile/document notes and account reasons stay private. Food review rationale is intentional.
    const reasonValue = metadata.reason ?? metadata.rationale;
    const reason =
      (outside || mealFlag || baseMeal) && typeof reasonValue === 'string' ? reasonValue.slice(0, 1000) : null;
    return {
      record,
      facts: auditFacts(metadata),
      reason,
      food: snapshot ? auditFood(snapshot) : null,
      previous: outside ? auditNutrition(metadata.previous) : null,
      effective: outside || baseMeal ? auditNutrition(metadata.effective) : null,
    };
  }
}

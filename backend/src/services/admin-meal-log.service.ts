import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import type { MealLogFilters } from '@/validation/admin-meal-log.schemas';
import { mealLogWhere, mealLogWindow, mealPopularityFacts, syntheticAccount } from './admin-meal-log-query';

async function admin(tx: Prisma.TransactionClient, id: string) {
  const actor = await tx.user.findUnique({ where: { id }, select: { role: true, isSuspended: true } });
  if (!actor || actor.role !== 'ADMIN' || actor.isSuspended)
    throw new AppError('Administrator access is required.', 403, 'ADMIN_REQUIRED');
}
type Row = {
  logId: string;
  memberName: string;
  memberId: string;
  ageGroup: string;
  membership: string;
  firstRecordedAt: Date | null;
  lastActionAt: Date | null;
  snapshot: Prisma.JsonValue;
  deleted: boolean;
  synthetic: boolean;
};

export class AdminMealLogService {
  static async list(actorId: string, filters: MealLogFilters) {
    return prisma.$transaction(
      async (tx) => {
        await admin(tx, actorId);
        const where = mealLogWhere(filters);
        const count = await tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`SELECT count(*) AS total FROM "MealLogAuditRecord" r JOIN "User" u ON u.id=r."userId" ${where}`
        );
        const rows = await tx.$queryRaw<
          Row[]
        >(Prisma.sql`SELECT r."logId",u.id AS "memberId",u.name AS "memberName",r."ageGroup",r.membership,
        r."firstRecordedAt",r."lastActionAt",r.snapshot - 'notes' AS snapshot,r.deleted, ${syntheticAccount} AS synthetic
        FROM "MealLogAuditRecord" r JOIN "User" u ON u.id=r."userId" ${where}
        ORDER BY (r.snapshot->>'mealDate')::timestamp DESC,r."logId" ASC LIMIT ${filters.limit} OFFSET ${(filters.page - 1) * filters.limit}`);
        const total = Number(count[0].total);
        return {
          rows,
          total,
          page: filters.page,
          totalPages: Math.ceil(total / filters.limit),
          window: mealLogWindow(filters),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );
  }

  static async detail(actorId: string, logId: string, page = 1) {
    return prisma.$transaction(
      async (tx) => {
        await admin(tx, actorId);
        const record = await tx.mealLogAuditRecord.findUnique({
          where: { logId },
          include: { user: { select: { id: true, name: true } } },
        });
        if (!record) throw new AppError('Meal log not found.', 404, 'MEAL_LOG_NOT_FOUND');
        const total = await tx.mealLogAuditEvent.count({ where: { logId } });
        const saved = await tx.mealLogAuditEvent.findMany({
          where: { logId },
          orderBy: { sequence: 'desc' },
          skip: (page - 1) * 20,
          take: 20,
        });
        const actors = await tx.user.findMany({
          where: { id: { in: [...new Set(saved.flatMap((e) => (e.actorUserId ? [e.actorUserId] : [])))] } },
          select: { id: true, name: true },
        });
        const events = saved.map(({ sequence, ...e }) => ({
          ...e,
          sequence: sequence.toString(),
          actorName: e.actorUserId
            ? (actors.find((a) => a.id === e.actorUserId)?.name ?? 'Former account')
            : 'System / unrecorded actor',
        }));
        const items = await tx.outsideMealLogItem.findMany({
          where: { mealLogId: logId },
          orderBy: { position: 'asc' },
          select: {
            id: true,
            name: true,
            portionGrams: true,
            source: true,
            nutritionStatus: true,
            includedInTotals: true,
            calories: true,
            proteinG: true,
            carbsG: true,
            fatG: true,
            currentRevision: true,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: actorId,
            action: 'ADMIN_MEAL_LOG_DETAILS_ACCESSED',
            entityType: 'MealLog',
            entityId: logId,
            metadata: { access: 'READ_ONLY_MEAL_LOG', page },
          },
        });
        const { userId, user, ...safe } = record;
        return {
          record: { ...safe, memberId: userId, memberName: user.name },
          items,
          events,
          total,
          page,
          totalPages: Math.ceil(total / 20),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );
  }

  static async popularity(actorId: string, filters: MealLogFilters) {
    return prisma.$transaction(
      async (tx) => {
        await admin(tx, actorId);
        const facts = mealPopularityFacts({ ...filters, member: undefined, status: undefined, recipeKey: undefined });
        const counts = await tx.$queryRaw<
          { total: bigint; unmatched: bigint; legacy: bigint }[]
        >(Prisma.sql`${facts} SELECT (SELECT count(*) FROM ranked) AS total,
        (SELECT count(*) FROM facts WHERE key IS NULL AND status='DONE') AS unmatched,
        (SELECT count(*) FROM base WHERE "contextVersion"='LEGACY_UNAVAILABLE') AS legacy`);
        const direction = filters.order === 'LEAST_EATEN' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
        const rows = await tx.$queryRaw<
          { key: string; name: string; eaten: number; skipped: number; members: number; repeatEaters: number }[]
        >(Prisma.sql`${facts}
        SELECT * FROM ranked ORDER BY eaten ${direction},members DESC,name ASC,key ASC LIMIT ${filters.limit} OFFSET ${(filters.page - 1) * filters.limit}`);
        const total = Number(counts[0].total);
        return {
          rows: rows.map((r) => ({
            ...r,
            eatenPercentage: r.eaten + r.skipped ? Math.round((r.eaten / (r.eaten + r.skipped)) * 1000) / 10 : null,
          })),
          total,
          page: filters.page,
          totalPages: Math.ceil(total / filters.limit),
          unmatchedItems: Number(counts[0].unmatched),
          legacyLogs: Number(counts[0].legacy),
          minimumCohort: filters.ageGroup || filters.membership ? 5 : 0,
          window: mealLogWindow(filters),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );
  }
}

import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { testCheckoutConfig } from '@/domain/membership-checkout.policy';
import { membershipHistoryEntry, type MembershipHistoryRecord } from '@/domain/membership-history.policy';

export type MembershipHistoryQuery = { page: number; limit: number };

async function assertActor(tx: Prisma.TransactionClient, actorId: string, memberId?: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId }, select: { role: true, isSuspended: true } });
  if (
    !actor ||
    actor.isSuspended ||
    (memberId ? actor.role !== 'ADMIN' && !(actor.role === 'USER' && actorId === memberId) : actor.role !== 'ADMIN')
  )
    throw new AppError('Subscription history is unavailable for this account.', 403, 'MEMBERSHIP_HISTORY_FORBIDDEN');
}

/** Persisted periods only. No entitlement writes, provider calls or clinical data. */
export class MembershipHistoryService {
  static async members(actorId: string, query: MembershipHistoryQuery & { search?: string }) {
    return prisma.$transaction(
      async (tx) => {
        await assertActor(tx, actorId);
        const where: Prisma.UserWhereInput = {
          role: 'USER',
          ...(query.search
            ? {
                OR: [
                  { name: { contains: query.search, mode: 'insensitive' } },
                  { email: { contains: query.search, mode: 'insensitive' } },
                ],
              }
            : {}),
        };
        const total = await tx.user.count({ where });
        const rows = await tx.user.findMany({
          where,
          select: { id: true, name: true, email: true },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        return { rows, total, page: query.page, totalPages: Math.ceil(total / query.limit) };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );
  }

  static async history(actorId: string, memberId: string, query: MembershipHistoryQuery, at = new Date()) {
    const configuration = testCheckoutConfig()?.accountHash ?? '';
    return prisma.$transaction(
      async (tx) => {
        await assertActor(tx, actorId, memberId);
        const member = await tx.user.findFirst({
          where: { id: memberId, role: 'USER' },
          select: { id: true, name: true },
        });
        if (!member) throw new AppError('Member not found.', 404, 'MEMBERSHIP_MEMBER_NOT_FOUND');
        // UNION ALL preserves distinct saved periods. The trial always appears first.
        const records = Prisma.sql`
        SELECT 'trial:' || "userId" AS id, 'TRIAL' AS kind, 'HEALTH' AS tier, NULL::text AS period,
          'TRIAL' AS source, "createdAt" AS "recordedAt", "trialStartedAt" AS "startsAt",
          NULL::timestamp AS "endsAt", NULL::timestamp AS "verifiedAt", NULL::timestamp AS "revokedAt",
          NULL::timestamp AS "supersededAt", NULL::integer AS "amountCentavos", NULL::text AS currency,
          true AS "currentConfiguration", 0 AS priority
        FROM "MembershipAccount" WHERE "userId" = ${memberId}
        UNION ALL
        SELECT 'grant:' || id, 'GRANT', tier::text, NULL::text, source, "createdAt", "effectiveFrom",
          "effectiveUntil", "verifiedAt", "revokedAt", NULL::timestamp, NULL::integer, NULL::text, true, 1
        FROM "MembershipGrant" WHERE "userId" = ${memberId} AND source IN ('PAID_INVOICE', 'ADMIN_ADJUSTMENT')
        UNION ALL
        SELECT 'checkout:' || id, 'CHECKOUT', tier::text, period::text, status::text, "createdAt", "effectiveFrom",
          "effectiveUntil", "verifiedAt", "revokedAt", "supersededAt", "amountCentavos", currency,
          "accountHash" = ${configuration}, 1
        FROM "MembershipTestCheckout" WHERE "userId" = ${memberId} AND status IN ('PAID', 'REVIEW')`;
        const count = await tx.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*) FROM (${records}) AS history`);
        const rows = await tx.$queryRaw<MembershipHistoryRecord[]>(Prisma.sql`
        SELECT * FROM (${records}) AS history
        ORDER BY priority ASC, "recordedAt" ASC, id ASC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`);
        const total = Number(count[0].count);
        return {
          member,
          rows: rows.map((row) => membershipHistoryEntry(row, at)),
          total,
          page: query.page,
          totalPages: Math.ceil(total / query.limit),
          serverTime: at.toISOString(),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead }
    );
  }
}

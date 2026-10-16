import prisma from '@/lib/prisma';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { Prisma } from '@prisma/client';
import { getManilaDateKey } from '@/domain/meal-plan-cycle.policy';

export type WaterHistoryDay = {
  date: string;
  totalMl: number;
  entryCount: number;
  entries: Array<{ id: string; amountMl: number; loggedAt: string }>;
};

export class WaterService {
  /** One bounded owner/date read; totals include every saved entry, details retain the newest 50 per day. */
  static async getHistory(userId: string, now = new Date(), client: Prisma.TransactionClient = prisma) {
    const today = getStartOfManilaBusinessDay(now);
    const start = new Date(+today - 6 * 86400000);
    const end = new Date(+today + 86400000);
    // Prisma DateTime columns store UTC as timestamp without time zone. Apply
    // Manila's fixed +08 offset explicitly, independently of the DB session zone.
    const recorded = await client.$queryRaw<WaterHistoryDay[]>`
      WITH ranked AS (
        SELECT id, "amountMl", "loggedAt",
          to_char("loggedAt" + interval '8 hours', 'YYYY-MM-DD') AS date,
          row_number() OVER (
            PARTITION BY to_char("loggedAt" + interval '8 hours', 'YYYY-MM-DD')
            ORDER BY "loggedAt" DESC, id DESC
          ) AS position
        FROM "WaterLog"
        WHERE "userId" = ${userId} AND "loggedAt" >= ${start} AND "loggedAt" < ${end}
      )
      SELECT date, sum("amountMl")::int AS "totalMl", count(*)::int AS "entryCount",
        jsonb_agg(jsonb_build_object(
          'id', id, 'amountMl', "amountMl",
          'loggedAt', to_char("loggedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
        ) ORDER BY "loggedAt" DESC, id DESC) FILTER (WHERE position <= 50) AS entries
      FROM ranked GROUP BY date ORDER BY date
    `;
    const byDate = new Map(recorded.map(day => [day.date, day]));
    const days: WaterHistoryDay[] = Array.from({ length: 7 }, (_, offset) => {
      const date = getManilaDateKey(new Date(+start + offset * 86400000));
      return byDate.get(date) ?? { date, totalMl: 0, entryCount: 0, entries: [] };
    });
    return { timeZone: 'Asia/Manila' as const, startDate: days[0].date, endDate: days[6].date, days };
  }

  static async getToday(userId: string, now = new Date(), client: Prisma.TransactionClient = prisma) {
    const start = getStartOfManilaBusinessDay(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const entries = await client.waterLog.findMany({
      where: { userId, loggedAt: { gte: start, lt: end } },
      orderBy: { loggedAt: 'asc' },
    });
    return {
      totalMl: entries.reduce((sum, entry) => sum + entry.amountMl, 0),
      entries,
    };
  }

  static async add(userId: string, amountMl: number) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      await tx.waterLog.create({ data: { userId, amountMl, loggedAt: now } });
      return this.getToday(userId, now, tx);
    });
  }

  static async resetToday(userId: string, now = new Date()) {
    const start = getStartOfManilaBusinessDay(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      await tx.waterLog.deleteMany({ where: { userId, loggedAt: { gte: start, lt: end } } });
      return { totalMl: 0, entries: [] };
    });
  }

  static async remove(userId: string, amountMl: number, now = new Date()) {
    const start = getStartOfManilaBusinessDay(now);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const entries = await tx.waterLog.findMany({
        where: { userId, loggedAt: { gte: start, lt: end } },
        orderBy: { loggedAt: 'desc' },
      });
      let remaining = amountMl;
      for (const entry of entries) {
        if (remaining <= 0) break;
        if (entry.amountMl <= remaining) {
          remaining -= entry.amountMl;
          await tx.waterLog.delete({ where: { id: entry.id } });
        } else {
          await tx.waterLog.update({
            where: { id: entry.id },
            data: { amountMl: entry.amountMl - remaining },
          });
          remaining = 0;
        }
      }
      return this.getToday(userId, now, tx);
    });
  }
}

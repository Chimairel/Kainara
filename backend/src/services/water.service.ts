import prisma from '@/lib/prisma';
import { getStartOfManilaBusinessDay } from '@/domain/meal-actionability.policy';
import { Prisma } from '@prisma/client';

export class WaterService {
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
        if (entry.amountMl <= remaining || entry.amountMl - remaining < 50) {
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

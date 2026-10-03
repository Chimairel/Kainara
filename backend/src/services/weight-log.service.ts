import prisma from '@/lib/prisma';
import { getWeightHistory } from './weight-history.service';
import { ProgressService } from './progress.service';

export class WeightLogService {
  /**
   * Returns all weight log entries for a user, ordered by date.
   */
  static async getWeightHistory(userId: string) {
    return getWeightHistory(userId);
  }

  /**
   * Creates a new weight log entry.
   */
  static async logWeight(userId: string, weightKg: number, note?: string) {
    return ProgressService.logWeight(userId, weightKg, note);
  }

  /**
   * Returns the latest weight log entry.
   */
  static async getLatestWeight(userId: string) {
    return prisma.weightLog.findFirst({
      where: { userId },
      orderBy: { loggedAt: 'desc' },
    });
  }
}

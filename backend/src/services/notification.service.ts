import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export class NotificationService {
  /** Queue alerts carry no patient names or health details. Queue APIs decide access. */
  static async notifyReviewers(title: string, message: string, db: Prisma.TransactionClient = prisma) {
    const reviewers = await db.nutritionistProfile.findMany({
      where: {
        isVerified: true,
        prcLicenseExpiry: { gt: new Date() },
        user: { role: 'NUTRITIONIST', isSuspended: false, emailVerified: true },
      },
      select: { userId: true },
    });
    if (reviewers.length)
      await db.notification.createMany({
        data: reviewers.map(({ userId }) => ({ userId, title, message, type: 'REVIEW_REQUEST' as const })),
      });
  }

  /**
   * Returns all notifications for a user, ordered newest first.
   */
  static async getUserNotifications(userId: string, limit = 50) {
    return prisma.notification.findMany({
      where: { userId, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Returns the count of unread notifications.
   */
  static async getUnreadCount(userId: string): Promise<number> {
    return prisma.notification.count({
      where: { userId, isRead: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    });
  }

  /**
   * Marks a single notification as read.
   */
  static async markAsRead(userId: string, notificationId: string) {
    return prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { isRead: true },
    });
  }

  static async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
  }

  /**
   * Creates a notification for a user.
   */
  static async create(userId: string, title: string, message: string, type: any) {
    return prisma.notification.create({
      data: { userId, title, message, type },
    });
  }
}

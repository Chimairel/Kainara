import webpush from 'web-push';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { isAllowedPushEndpoint } from '@/domain/meal-reminder.policy';
import { pushSubscriptionSchema } from '@/validation/meal-reminder.schemas';

export function pushConfiguration() {
  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const subject = process.env.WEB_PUSH_SUBJECT;
  if (process.env.WEB_PUSH_ENABLED !== 'true' || !publicKey || !privateKey || !subject) return null;
  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
  } catch {
    return null;
  }
  return { subject, publicKey, privateKey };
}

export class WebPushService {
  static async subscribe(userId: string, input: z.infer<typeof pushSubscriptionSchema>) {
    if (!pushConfiguration())
      throw new AppError('Device notifications are not configured yet.', 503, 'PUSH_UNAVAILABLE');
    return prisma.$transaction(async (tx) => {
      const existing = await tx.webPushSubscription.findUnique({ where: { endpoint: input.endpoint } });
      if (existing && (existing.p256dh !== input.keys.p256dh || existing.auth !== input.keys.auth))
        throw new AppError(
          'This subscription has changed. Disable and enable device notifications again.',
          409,
          'PUSH_SUBSCRIPTION_CONFLICT'
        );
      if (existing?.userId !== userId && (await tx.webPushSubscription.count({ where: { userId } })) >= 8)
        throw new AppError(
          'The device limit has been reached. Disable notifications on an unused device.',
          409,
          'PUSH_DEVICE_LIMIT'
        );
      if (existing && existing.userId !== userId) {
        await tx.webPushDelivery.deleteMany({ where: { subscriptionId: existing.id } });
      }
      await tx.webPushSubscription.upsert({
        where: { endpoint: input.endpoint },
        create: { userId, endpoint: input.endpoint, ...input.keys },
        update: { userId, ...(existing?.userId !== userId ? { createdAt: new Date() } : {}) },
      });
      return { subscribed: true };
    });
  }

  static async unsubscribe(userId: string, endpoint: string) {
    await prisma.webPushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  static async test(userId: string, endpoint: string) {
    const subscription = await prisma.webPushSubscription.findFirst({ where: { userId, endpoint } });
    if (!subscription) throw new AppError('Enable notifications on this device first.', 409, 'PUSH_NOT_SUBSCRIBED');
    const recent = await prisma.webPushDelivery.findFirst({
      where: { subscriptionId: subscription.id, attemptedAt: { gte: new Date(Date.now() - 60_000) } },
    });
    if (recent) throw new AppError('Wait a minute before sending another test.', 429, 'PUSH_TEST_LIMIT');
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: 'MEAL_REMINDER',
        title: 'KAINARA notifications are ready',
        message: 'This is a test notification from KAINARA.',
        targetPath: '/profile/planning',
        expiresAt: new Date(Date.now() + 60_000),
        context: { test: true },
      },
    });
    const sent = await this.deliver(subscription.id, notification.id);
    if (!sent)
      throw new AppError(
        'The push service did not confirm delivery. Try enabling this device again.',
        503,
        'PUSH_SEND_FAILED'
      );
    return { accepted: true };
  }

  /** A unique receipt and atomic claim prevent overlapping workers from repeating sends. */
  static async deliver(subscriptionId: string, notificationId: string, eligible?: () => Promise<boolean>) {
    const config = pushConfiguration();
    if (!config) return false;
    await prisma.webPushDelivery.createMany({ data: [{ subscriptionId, notificationId }], skipDuplicates: true });
    const claimed = await prisma.webPushDelivery.updateMany({
      where: { subscriptionId, notificationId, status: 'PENDING' },
      data: { status: 'SENDING', attemptedAt: new Date() },
    });
    if (!claimed.count) return false;
    const finish = async (status: string) =>
      prisma.webPushDelivery.updateMany({
        where: { subscriptionId, notificationId, status: 'SENDING' },
        data: { status },
      });
    const [subscription, notification] = await Promise.all([
      prisma.webPushSubscription.findUnique({
        where: { id: subscriptionId },
        include: {
          user: { select: { role: true, emailVerified: true, isSuspended: true } },
        },
      }),
      prisma.notification.findUnique({ where: { id: notificationId } }),
    ]);
    if (
      !subscription ||
      !notification ||
      subscription.userId !== notification.userId ||
      notification.isRead ||
      subscription.user.isSuspended ||
      !subscription.user.emailVerified ||
      (notification.expiresAt && notification.expiresAt <= new Date()) ||
      !isAllowedPushEndpoint(subscription.endpoint) ||
      (eligible && !(await eligible()))
    ) {
      await finish('CANCELLED');
      return false;
    }
    try {
      // Existing inbox messages can contain private context. System banners stay generic.
      const reminder = notification.type === 'MEAL_REMINDER';
      const ttl = Math.max(
        1,
        Math.min(600, notification.expiresAt ? Math.floor((notification.expiresAt.getTime() - Date.now()) / 1000) : 600)
      );
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({
          title: reminder ? notification.title : 'KAINARA',
          body: reminder ? notification.message : 'You have a new notification. Open KAINARA to view it.',
          tag: `kainara-${notification.id}`,
          path:
            notification.targetPath ||
            (subscription.user.role === 'ADMIN'
              ? '/admin/overview'
              : subscription.user.role === 'NUTRITIONIST'
                ? '/nutritionist/reviews'
                : '/dashboard'),
          expiresAt: notification.expiresAt?.toISOString() || new Date(Date.now() + ttl * 1000).toISOString(),
        }),
        { vapidDetails: config, TTL: ttl, timeout: 10_000, urgency: 'normal' }
      );
      await finish('SENT');
      return true;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410)
        await prisma.webPushSubscription.deleteMany({
          where: { id: subscriptionId, userId: subscription.userId, endpoint: subscription.endpoint },
        });
      else await finish('FAILED');
      // Do not log subscriptions/provider response bodies or retry ambiguous sends.
      return false;
    }
  }
}

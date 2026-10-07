import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import { AuthenticatedRequest } from '@/types';
import { NotificationService } from '@/services/notification.service';
import { asyncHandler } from '@/middleware/errorHandler';
import validateZodBody from '@/middleware/validateZod';
import { requireVerifiedUser } from '@/middleware/userPrerequisites';
import { WebPushService, pushConfiguration } from '@/services/web-push.service';
import { pushEndpointSchema, pushSubscriptionSchema } from '@/validation/meal-reminder.schemas';
import prisma from '@/lib/prisma';

const router = Router();
router.use(authenticate);

router.get('/push/config', requireVerifiedUser, (_req, res) => {
  const config = pushConfiguration();
  res.json({ success: true, data: { available: Boolean(config), publicKey: config?.publicKey ?? null } });
});
router.post(
  '/push/subscription',
  requireVerifiedUser,
  validateZodBody(pushSubscriptionSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    res.json({ success: true, data: await WebPushService.subscribe(req.user!.userId, req.body) });
  })
);
router.post(
  '/push/status',
  validateZodBody(pushEndpointSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const subscription = await prisma.webPushSubscription.findFirst({
      where: { userId: req.user!.userId, endpoint: req.body.endpoint },
      select: {
        id: true,
        deliveries: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, attemptedAt: true } },
      },
    });
    res.json({
      success: true,
      data: { subscribed: Boolean(subscription), delivery: subscription?.deliveries[0] ?? null },
    });
  })
);
router.delete(
  '/push/subscription',
  validateZodBody(pushEndpointSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    await WebPushService.unsubscribe(req.user!.userId, req.body.endpoint);
    res.json({ success: true });
  })
);
router.post(
  '/push/test',
  requireVerifiedUser,
  validateZodBody(pushEndpointSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const result = await WebPushService.test(req.user!.userId, req.body.endpoint);
    res.status(result.accepted ? 200 : 202).json({ success: true, data: result });
  })
);

// The same inbox belongs to the signed-in account, regardless of its role.
router.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user!.userId;
    const [notifications, unreadCount] = await Promise.all([
      NotificationService.getUserNotifications(userId),
      NotificationService.getUnreadCount(userId),
    ]);
    res.json({ success: true, data: { notifications, unreadCount } });
  })
);

router.patch(
  '/read-all',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await NotificationService.markAllAsRead(req.user!.userId);
    res.json({ success: true });
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await NotificationService.markAsRead(req.user!.userId, req.params.id);
    res.json({ success: true });
  })
);

export default router;

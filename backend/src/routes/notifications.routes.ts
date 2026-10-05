import { Router, Response } from 'express';
import authenticate from '@/middleware/auth';
import { AuthenticatedRequest } from '@/types';
import { NotificationService } from '@/services/notification.service';
import { asyncHandler } from '@/middleware/errorHandler';

const router = Router();
router.use(authenticate);

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

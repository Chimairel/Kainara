import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '@/types';
import { publishLiveUpdate } from '@/lib/live-updates';

export function liveMutationUpdates(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  res.on('finish', () => {
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method) || res.statusCode < 200 || res.statusCode >= 300)
      return;
    if (req.originalUrl.startsWith('/api/auth') || /\/(?:status|license-availability)$/.test(req.path)) return;
    if (req.user) {
      publishLiveUpdate({
        userId: req.user.userId,
        roles: req.originalUrl.startsWith('/api/notifications')
          ? []
          : req.user.role === 'USER'
            ? ['ADMIN', 'NUTRITIONIST']
            : ['ADMIN', 'NUTRITIONIST', 'USER'],
      });
    } else if (req.originalUrl === '/api/nutritionist-applications') {
      publishLiveUpdate({ roles: ['ADMIN'] });
    } else if (req.originalUrl.startsWith('/api/cron/')) {
      publishLiveUpdate({ roles: ['USER', 'NUTRITIONIST', 'ADMIN'] });
    }
  });
  next();
}

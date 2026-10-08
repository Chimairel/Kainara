import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '@/middleware/errorHandler';
import { AppError } from '@/errors/AppError';
import type { AuthenticatedRequest } from '@/types';
import { MembershipHistoryService } from '@/services/membership-history.service';

const paging = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(10),
};
export const membershipHistoryQuery = z.object(paging).strict();
const membersQuery = z.object({ ...paging, search: z.string().trim().max(200).optional() }).strict();
function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError('Check the subscription history filters.', 400, 'INVALID_HISTORY_FILTERS');
  return result.data;
}
export const memberHistoryRouter = Router();
memberHistoryRouter.get(
  '/',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const query = parse(membershipHistoryQuery, req.query);
    const data = await MembershipHistoryService.history(req.user!.userId, req.user!.userId, query);
    res.set('Cache-Control', 'private, no-store').json({ success: true, data });
  })
);

export const adminMembershipHistoryRouter = Router();
adminMembershipHistoryRouter.get(
  '/members',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const query = parse(membersQuery, req.query);
    const data = await MembershipHistoryService.members(req.user!.userId, query);
    res.set('Cache-Control', 'private, no-store').json({ success: true, data });
  })
);
adminMembershipHistoryRouter.get(
  '/:memberId',
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const memberId = parse(z.string().min(1).max(191), req.params.memberId);
    const query = parse(membershipHistoryQuery, req.query);
    const data = await MembershipHistoryService.history(req.user!.userId, memberId, query);
    res.set('Cache-Control', 'private, no-store').json({ success: true, data });
  })
);

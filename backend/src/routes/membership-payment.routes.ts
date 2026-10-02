import { Router } from 'express';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { asyncHandler } from '@/middleware/errorHandler';
import { MembershipCheckoutService } from '@/services/membership-checkout.service';
import { testCheckoutConfig, verifyTestWebhook } from '@/domain/membership-checkout.policy';

const router = Router();
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const c = testCheckoutConfig();
    if (!c?.webhookSecret) throw new AppError('Demo webhook is not configured.', 503, 'WEBHOOK_UNAVAILABLE');
    if (
      !Buffer.isBuffer(req.body) ||
      !verifyTestWebhook(req.body, req.header('Paymongo-Signature') ?? '', c.webhookSecret)
    )
      throw new AppError('Invalid webhook signature.', 401, 'WEBHOOK_SIGNATURE_INVALID');
    let body: unknown;
    try {
      body = JSON.parse(req.body.toString('utf8'));
    } catch {
      throw new AppError('Invalid webhook body.', 400, 'WEBHOOK_INVALID');
    }
    const event = z
      .object({
        data: z.object({
          attributes: z.object({
            type: z.literal('checkout_session.payment.paid'),
            livemode: z.literal(false),
            data: z.object({ id: z.string(), type: z.literal('checkout_session') }),
          }),
        }),
      })
      .safeParse(body);
    if (event.success) {
      const row = await prisma.membershipTestCheckout.findFirst({
        where: {
          providerSessionId: event.data.data.attributes.data.id,
          accountHash: c.accountHash,
        },
        select: { id: true },
      });
      if (row) await MembershipCheckoutService.reconcile(row.id);
    }
    res.json({ success: true });
  })
);
export default router;

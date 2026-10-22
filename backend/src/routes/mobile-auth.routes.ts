import { Router } from 'express';
import { z } from 'zod';
import { MobileAuthController, requireMobileTransport } from '@/controllers/mobile-auth.controller';
import { accountCreationLimiter, loginLimiter, sessionLimiter } from '@/middleware/rateLimiter';
import { loginEmailLimiter, registrationEmailLimiter } from '@/middleware/attemptLimiter';
import { validateZodBody } from '@/middleware/validateZod';
import { newPasswordSchema } from '@/validation/password.schemas';

const router = Router();
const email = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
const credentials = z.object({ email: z.string().trim().pipe(email), password: z.string().min(1).max(128) }).strict();
const refresh = z.object({ refreshToken: z.string().min(20).max(8192) }).strict();
router.use(requireMobileTransport);
router.post('/login', loginLimiter, loginEmailLimiter, validateZodBody(credentials), MobileAuthController.login);
router.post(
  '/register',
  accountCreationLimiter,
  registrationEmailLimiter,
  validateZodBody(
    z
      .object({
        name: z
          .string()
          .trim()
          .min(1)
          .max(161)
          .regex(/[\p{L}]/u)
          .regex(/^[\p{L}\p{M}'’ .-]+$/u),
        email: z.string().trim().pipe(email),
        password: newPasswordSchema,
      })
      .strict()
  ),
  MobileAuthController.register
);
router.post('/refresh', sessionLimiter, validateZodBody(refresh), MobileAuthController.refresh);
router.post('/logout', sessionLimiter, validateZodBody(refresh), MobileAuthController.logout);
export default router;

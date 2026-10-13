import { createHash } from 'node:crypto';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '@/types';

const connectionKey = (req: Request) => `ip:${ipKeyGenerator(req.ip || 'unknown')}`;
/** Match authentication's normalization without retaining addresses in the limiter store. */
export function emailAttemptKey(req: Request): string {
  const email = req.body?.email;
  if (typeof email !== 'string' || email.length > 254 || !email.trim()) return connectionKey(req);
  return `email:${createHash('sha256').update(email.trim().toLowerCase()).digest('hex')}`;
}
export const accountAttemptKey = (req: Request) =>
  `account:${(req as AuthenticatedRequest).user!.userId}`;

/** All attempts count unless explicitly limited to unsuccessful sign-ins. Memory is per API process. */
export function attemptLimiter(limit: number, minutes: number, message: string,
  keyGenerator = connectionKey, failedOnly = false, errorCode = 'ATTEMPT_LIMITED') {
  const windowMs = minutes * 60_000;
  return rateLimit({ limit, windowMs, keyGenerator, skipSuccessfulRequests: failedOnly,
    standardHeaders: 'draft-7', legacyHeaders: false,
    handler(req, res) {
      const retryAfterSeconds = Math.max(1, Math.ceil((((req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit?.resetTime?.getTime() ?? Date.now() + windowMs) - Date.now()) / 1000));
      res.setHeader('Retry-After', retryAfterSeconds);
      res.status(429).json({ success: false, error: message, errorCode, retryAfterSeconds });
    },
  });
}

export const loginEmailLimiter = attemptLimiter(5, 15, 'Too many failed sign-in attempts for this email.', emailAttemptKey, true);
export const registrationEmailLimiter = attemptLimiter(5, 60, 'Too many registration attempts for this email.', emailAttemptKey);
export const recoveryEmailLimiter = attemptLimiter(5, 60, 'Too many password recovery attempts for this email.', emailAttemptKey);
export const resetAttemptLimiter = attemptLimiter(10, 60, 'Too many password reset attempts from this connection.');
export const verificationAccountLimiter = attemptLimiter(20, 15, 'Too many verification attempts.', accountAttemptKey);
export const resendAccountLimiter = attemptLimiter(5, 60, 'Too many verification emails requested.', accountAttemptKey);
export const supportConnectionLimiter = attemptLimiter(20, 60, 'Too many support attempts from this connection.');
export const supportAccountLimiter = attemptLimiter(5, 60, 'You have sent several support requests.', accountAttemptKey, false, 'SUPPORT_RATE_LIMITED');
export const supportReplyLimiter = attemptLimiter(60, 60, 'Reply limit reached.', accountAttemptKey);

import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { Request } from 'express';

/** A signed access identity separates colleagues sharing Wi-Fi. This never grants API access. */
export function apiBrowsingKey(req: Pick<Request, 'headers' | 'ip'>): string {
  const header = req.headers.authorization;
  const secret = process.env.JWT_SECRET;
  if (secret && typeof header === 'string' && header.startsWith('Bearer ')) {
    try {
      const claims = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'] });
      if (
        typeof claims === 'object' &&
        typeof claims.userId === 'string' &&
        claims.userId.length > 0 &&
        claims.userId.length <= 100
      ) {
        return `account:${claims.userId}`;
      }
    } catch {
      /* Invalid/expired/unsigned tokens keep the anonymous IP budget. */
    }
  }
  return `ip:${ipKeyGenerator(req.ip || 'unknown')}`;
}

/** Failed sign-ins have their own budget; successful sign-ins do not consume it. */
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 500 : 20,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many failed sign-in attempts. Please try again after 15 minutes.',
  },
});

/** Registration and recovery are limited independently of sign-in. */
export const accountCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 500 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts. Please try again later.' },
});

export const passwordRecoveryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 500 : 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many password recovery attempts. Please try again later.' },
});

/** Refresh and logout remain bounded even though auth bypasses the browsing budget. */
export const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'development' ? 1000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many session requests. Please try again later.' },
});

export const verificationAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many verification attempts from this connection. Please try again later.',
  },
});

export const verificationResendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many verification emails requested. Please try again later.',
  },
});

export const professionalApplicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many professional applications from this connection. Please try again later.',
  },
});

export const applicationStatusLimiter = rateLimit({
  skipSuccessfulRequests: true,
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many application status attempts. Please try again later.',
  },
});

/**
 * Browsing has its own budget. Auth routes are mounted before this middleware.
 */
export const apiLimiter = rateLimit({
  keyGenerator: apiBrowsingKey,
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1200 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down and try again shortly.',
  },
});

/**
 * Rate limiter for Gemini AI-hitting endpoints (meal generation, report generation).
 * Strict: 5 requests per 5-minute window per IP.
 */
export const geminiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'AI generation rate limit reached. Please wait a few minutes before generating again.',
  },
});

/** Polling is bounded separately from failed reference/email lookups. */
export const applicationStatusReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Application updates paused. Please try again shortly.' },
});
export const applicationLicenseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many license checks. Please try again shortly.' },
});

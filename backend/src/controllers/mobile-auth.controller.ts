import type { Request, Response, NextFunction } from 'express';
import AuthService from '@/services/auth.service';
import { databaseAvailabilityFailure } from '@/lib/database-availability';
import { sanitizeErrorMessage } from '@/lib/sanitizeError';

/** Explicit native transport. Browser routes continue to use HttpOnly cookies. */
export function requireMobileTransport(req: Request, res: Response, next: NextFunction) {
  if (process.env.MOBILE_AUTH_ENABLED !== 'true') {
    res
      .status(404)
      .json({
        success: false,
        error: 'Mobile sign-in is not enabled on this server.',
        errorCode: 'MOBILE_AUTH_DISABLED',
      });
    return;
  }
  // This is not client authentication. The ordinary credential/session checks
  // still apply; refusing browser-origin requests avoids accidental token exposure
  // in the website, including same-origin fetches and form submissions.
  if (req.headers.origin || req.headers['sec-fetch-site'] || req.headers['sec-fetch-mode']) {
    res.status(403).json({ success: false, error: 'Use the website sign-in flow in a browser.' });
    return;
  }
  res.set('Cache-Control', 'private, no-store');
  next();
}

function failure(res: Response, error: unknown, fallback: string, status = 400) {
  const unavailable = databaseAvailabilityFailure(error);
  if (unavailable || (error instanceof Error && error.name.startsWith('PrismaClient'))) {
    return res
      .status(503)
      .json({
        success: false,
        error: unavailable?.message ?? 'Session service is temporarily unavailable.',
        errorCode: unavailable?.errorCode ?? 'SESSION_REFRESH_UNAVAILABLE',
      });
  }
  return res.status(status).json({ success: false, error: sanitizeErrorMessage(error, fallback) });
}

export class MobileAuthController {
  static async login(req: Request, res: Response) {
    try {
      const result = await AuthService.login(req.body.email, req.body.password);
      if (result.user.role !== 'USER') {
        await AuthService.logoutWithRefreshToken(result.refreshToken);
        return res.status(403).json({ success: false, error: 'Use the KAINARA website for staff accounts.' });
      }
      return res.json({ success: true, data: result });
    } catch (error) {
      return failure(res, error, 'Could not sign in.');
    }
  }

  static async register(req: Request, res: Response) {
    try {
      const result = await AuthService.register(req.body.name, req.body.email, req.body.password);
      return res.status(201).json({ success: true, data: result });
    } catch (error) {
      return failure(res, error, 'Could not create your account.');
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const result = await AuthService.refreshToken(req.body.refreshToken);
      return res.json({ success: true, data: result });
    } catch (error) {
      return failure(res, error, 'Sign in again to continue.', 401);
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      await AuthService.logoutWithRefreshToken(req.body.refreshToken);
      return res.json({ success: true, data: { message: 'Signed out.' } });
    } catch (error) {
      return failure(res, error, 'Could not revoke the session. Try again.', 503);
    }
  }
}

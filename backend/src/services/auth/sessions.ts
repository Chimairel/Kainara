import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@/lib/jwt';
import { JWTPayload } from '@/types';

export const REFRESH_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
// Remote database latency/short row-lock waits can exceed Prisma's 5s default.
// Keep session writes bounded and do not replay an ambiguously committed write.
const SESSION_TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 15_000 };

export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createRefreshSession(
  userId: string,
  payload: JWTPayload,
  expectedPasswordHash?: string
): Promise<string> {
  const refreshToken = signRefreshToken(payload);
  if (expectedPasswordHash !== undefined) {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { isSuspended: true, passwordLoginEnabled: true, passwordHash: true },
      });
      if (
        !current ||
        current.isSuspended ||
        !current.passwordLoginEnabled ||
        current.passwordHash !== expectedPasswordHash
      )
        throw new Error('Account credentials changed. Sign in again.');
      await tx.session.create({
        data: {
          userId,
          sessionToken: hashSessionToken(refreshToken),
          expires: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
        },
      });
    }, SESSION_TRANSACTION_OPTIONS);
  } else {
    await prisma.session.create({
      data: {
        userId,
        sessionToken: hashSessionToken(refreshToken),
        expires: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
      },
    });
  }
  return refreshToken;
}

/**
 * Refreshes an expired access token using a valid refresh token.
 */
export async function refreshToken(token: string) {
  // Verify refresh token (throws if invalid or expired)
  const decoded = verifyRefreshToken(token);

  const currentTokenHash = hashSessionToken(token);

  // Fetch user to confirm they still exist and check for role updates
  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
  });

  if (!user) {
    throw new Error('User session not found.');
  }
  if (user.isSuspended) {
    await prisma.session.deleteMany({ where: { userId: user.id } });
    throw new Error('This account has been suspended.');
  }

  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const session = await prisma.session.findUnique({
    where: { sessionToken: currentTokenHash },
  });
  if (!session || session.userId !== user.id || session.expires <= new Date()) {
    if (session) await prisma.session.deleteMany({ where: { id: session.id } });
    throw new Error('Refresh session is expired or has been revoked.');
  }

  // Rotate both the access token and the persisted refresh session. Replaying
  // the previous cookie fails after this transaction commits.
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await prisma.$transaction(async (tx) => {
    const deleted = await tx.session.deleteMany({
      where: { id: session.id, sessionToken: currentTokenHash },
    });
    if (deleted.count !== 1) {
      throw new Error('Refresh session was already rotated.');
    }
    await tx.session.create({
      data: {
        userId: user.id,
        sessionToken: hashSessionToken(refreshToken),
        expires: new Date(Date.now() + REFRESH_SESSION_TTL_MS),
      },
    });
  }, SESSION_TRANSACTION_OPTIONS);

  return {
    accessToken,
    refreshToken,
  };
}

/**
 * Logs out the user by deleting all their sessions from the database.
 */
export async function logout(userId: string) {
  await prisma.session.deleteMany({
    where: { userId },
  });

  return { message: 'Logged out successfully.' };
}

/** Revokes the current browser session even when its access token has expired. */
export async function logoutWithRefreshToken(token: string) {
  let decoded: JWTPayload;
  try {
    decoded = verifyRefreshToken(token);
  } catch {
    return;
  }

  const sessionToken = hashSessionToken(token);
  await prisma.session.deleteMany({
    where: { userId: decoded.userId, sessionToken },
  });
}

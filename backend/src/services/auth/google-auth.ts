import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { JWTPayload } from '@/types';

import { OAuth2Client } from 'google-auth-library';

import { GoogleAuthFlowError, type GoogleAuthIntent, type VerifiedGoogleIdentity } from './google-identity';
import { createRefreshSession } from './sessions';

/**
 * Verifies a Google ID token without creating a session or mutating an account.
 * Used by destructive-account reauthentication as well as Google login.
 */
export async function verifyGoogleIdentity(idToken: string): Promise<VerifiedGoogleIdentity> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error('Google OAuth is not configured on the server.');
  }

  const client = new OAuth2Client(clientId);
  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: clientId,
    });
  } catch {
    throw new Error('Invalid Google credential. Please try again.');
  }

  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub || payload.email_verified !== true) {
    throw new Error('Unable to retrieve a verified account identity from Google.');
  }
  return {
    email: payload.email,
    sub: payload.sub,
    // Google controls Gmail and verified Workspace addresses, not arbitrary third-party mailboxes.
    emailAuthoritative: payload.email.trim().toLowerCase().endsWith('@gmail.com') || Boolean(payload.hd),
    given_name: payload.given_name,
    family_name: payload.family_name,
    name: payload.name,
    picture: payload.picture,
  };
}

/**
 * Continues the flow after cryptographic Google-token verification. Keeping
 * this boundary explicit makes the login-vs-registration policy testable
 * without weakening token verification at the HTTP boundary.
 */
export async function completeGoogleAuth(
  payload: VerifiedGoogleIdentity,
  intent: GoogleAuthIntent,
  beforeCreate?: () => Promise<void>
) {
  const { email, given_name, family_name, name: googleName, picture, sub } = payload;
  const sanitizedEmail = email.trim().toLowerCase();
  const displayName = [given_name, family_name].filter(Boolean).join(' ') || googleName || 'Google User';

  const linkedAccount = await prisma.account.findFirst({
    where: { provider: 'google', providerAccountId: sub },
    include: { user: true },
  });
  let user =
    linkedAccount?.user ??
    (await prisma.user.findUnique({
      where: { email: sanitizedEmail },
    }));

  if (intent === 'LOGIN' && !user) {
    throw new GoogleAuthFlowError(
      'ACCOUNT_NOT_FOUND',
      404,
      'No KAINARA account exists for this Google address. Create an account first.'
    );
  }
  if (intent === 'REGISTER' && user) {
    throw new GoogleAuthFlowError(
      'ACCOUNT_EXISTS',
      409,
      'A KAINARA account already exists for this Google address. Sign in instead.'
    );
  }

  if (user) {
    if (user.isSuspended) throw new Error('This account has been suspended.');
    if (user.role === 'NUTRITIONIST') {
      const application = await prisma.nutritionistApplication.findUnique({
        where: { invitedUserId: user.id },
        select: { status: true },
      });
      if (application && application.status !== 'ACTIVATED') {
        throw new Error('Complete your nutritionist invitation before signing in.');
      }
    }
    const existingGoogleAccount = await prisma.account.findFirst({
      where: { userId: user.id, provider: 'google' },
    });
    if (existingGoogleAccount && existingGoogleAccount.providerAccountId !== sub) {
      throw new GoogleAuthFlowError(
        'GOOGLE_IDENTITY_MISMATCH',
        409,
        'This KAINARA account is already linked to a different Google identity.'
      );
    }

    if (!existingGoogleAccount && !payload.emailAuthoritative) {
      throw new GoogleAuthFlowError(
        'GOOGLE_LINK_REQUIRED',
        409,
        'An account already uses this email. Sign in with your existing account method to prove ownership.'
      );
    }

    // Only Google-controlled email addresses may automatically link a local
    // account. Returning users are matched by their durable Google subject.
    if (existingGoogleAccount) {
      await prisma.account.update({
        where: { id: existingGoogleAccount.id },
        data: picture ? { access_token: picture } : {},
      });
    } else {
      await prisma.account.create({
        data: {
          userId: user.id,
          type: 'oauth',
          provider: 'google',
          providerAccountId: sub,
          access_token: picture ?? null,
        },
      });
    }

    if (!user.emailVerified && sanitizedEmail === user.email && payload.emailAuthoritative !== false) {
      const verified = await prisma.user.updateMany({
        where: { id: user.id, email: sanitizedEmail, emailVerified: false },
        data: {
          emailVerified: true,
          emailVerificationToken: null,
          emailVerificationExpiry: null,
        },
      });
      if (verified.count === 1) user = { ...user, emailVerified: true };
    }

    // Refresh an imported profile photo; preserve explicitly chosen initials/avatars.
    if (picture && (!user.image || user.image.startsWith('https://lh3.googleusercontent.com'))) {
      await prisma.user.update({
        where: { id: user.id },
        data: { image: picture },
      });
      user = { ...user, image: picture };
    }
  } else {
    await beforeCreate?.();
    // Google account creation. The random password is deliberately
    // unknowable; this account signs in through its linked Google identity.
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(randomPassword, salt);

    user = await prisma.user.create({
      data: {
        name: displayName,
        email: sanitizedEmail,
        passwordHash,
        passwordLoginEnabled: false,
        role: 'USER',
        emailVerified: true,
        image: picture || null,
        accounts: {
          create: {
            type: 'oauth',
            provider: 'google',
            providerAccountId: sub,
            access_token: picture ?? null,
          },
        },
      },
    });
  }

  // Create token payloads
  const jwtPayload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = signAccessToken(jwtPayload);
  const refreshToken = await createRefreshSession(user.id, jwtPayload);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      onboardingDone: user.onboardingDone,
    },
    accessToken,
    refreshToken,
  };
}

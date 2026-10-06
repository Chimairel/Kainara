import bcrypt from 'bcryptjs';

import prisma from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { JWTPayload } from '@/types';
import { sendPasswordResetEmail } from '@/lib/email';

import { generateResetToken } from './credentials';

import { createRefreshSession } from './sessions';

/**
 * Validates credentials and logs in the user.
 */
export async function login(email: string, password: string) {
  const sanitizedEmail = email.trim().toLowerCase();

  // Search for user
  const user = await prisma.user.findUnique({
    where: { email: sanitizedEmail },
  });

  if (!user || !user.passwordLoginEnabled) {
    throw new Error('Invalid email or password credentials.');
  }
  if (user.isSuspended) throw new Error('This account has been suspended.');
  // Verify hashed password
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new Error('Invalid email or password credentials.');
  }
  if (user.role === 'NUTRITIONIST') {
    const application = await prisma.nutritionistApplication.findUnique({
      where: { invitedUserId: user.id },
      select: { status: true },
    });
    if (application && application.status !== 'ACTIVATED') {
      throw new Error('Complete your nutritionist invitation before signing in.');
    }
  }

  // Create token payloads
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  // Generate tokens
  const accessToken = signAccessToken(payload);
  const refreshToken = await createRefreshSession(user.id, payload, user.passwordHash);

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

/**
 * Initiates password reset by sending a reset link email.
 * Always returns success message to prevent email enumeration attacks.
 */
export async function forgotPassword(email: string) {
  const sanitizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: sanitizedEmail },
  });

  // Always return success to prevent email enumeration
  if (!user || !user.passwordLoginEnabled) {
    return { message: 'If an account with that email exists, a reset link has been sent.' };
  }
  if (user.role === 'NUTRITIONIST') {
    const application = await prisma.nutritionistApplication.findUnique({
      where: { invitedUserId: user.id },
      select: { status: true },
    });
    if (application && application.status !== 'ACTIVATED') {
      return { message: 'If an account with that email exists, a reset link has been sent.' };
    }
  }

  // Generate reset token
  const resetToken = generateResetToken();
  const resetTokenHash = await bcrypt.hash(resetToken, 10);
  const resetExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  const issued = await prisma.user.updateMany({
    where: { id: user.id, email: user.email, passwordHash: user.passwordHash, passwordLoginEnabled: true },
    data: {
      passwordResetToken: resetTokenHash,
      passwordResetExpiry: resetExpiry,
    },
  });
  if (issued.count !== 1) return { message: 'If an account with that email exists, a reset link has been sent.' };

  // Send reset email
  try {
    await sendPasswordResetEmail(user.email, resetToken, user.name);
  } catch (emailErr) {
    console.error('[AuthService] Password reset email failed:', emailErr);
  }

  return { message: 'If an account with that email exists, a reset link has been sent.' };
}

/**
 * Resets the user's password using a valid reset token.
 */
export async function resetPassword(token: string, newPassword: string) {
  // Find all users with non-null reset tokens (there should be very few)
  const usersWithResetTokens = await prisma.user.findMany({
    where: {
      passwordResetToken: { not: null },
      passwordResetExpiry: { gte: new Date() }, // Only non-expired tokens
    },
  });

  // Compare the provided token against each stored hash
  let matchedUser = null;
  for (const user of usersWithResetTokens) {
    if (user.passwordResetToken) {
      const isMatch = await bcrypt.compare(token, user.passwordResetToken);
      if (isMatch) {
        matchedUser = user;
        break;
      }
    }
  }

  if (!matchedUser) {
    throw new Error('Invalid or expired reset link. Please request a new one.');
  }
  if (!matchedUser.passwordLoginEnabled) {
    throw new Error('Invalid or expired reset link. Please request a new one.');
  }
  if (matchedUser.role === 'NUTRITIONIST') {
    const application = await prisma.nutritionistApplication.findUnique({
      where: { invitedUserId: matchedUser.id },
      select: { status: true },
    });
    if (application && application.status !== 'ACTIVATED') {
      throw new Error('Complete your nutritionist invitation before resetting your password.');
    }
  }

  // Hash the new password and clear reset fields
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(newPassword, salt);

  await prisma.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: {
        id: matchedUser.id,
        passwordResetToken: matchedUser.passwordResetToken,
        passwordResetExpiry: { gt: new Date() },
      },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiry: null,
      },
    });
    if (changed.count !== 1) {
      throw new Error('This reset link was already used or replaced. Please request a new one.');
    }
    await tx.session.deleteMany({ where: { userId: matchedUser.id } });
  });

  return { message: 'Password has been reset successfully. You can now log in.' };
}

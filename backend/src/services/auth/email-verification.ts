import bcrypt from 'bcryptjs';

import prisma from '@/lib/prisma';

import { sendVerificationEmail } from '@/lib/email';

import {
  EMAIL_VERIFICATION_LOCK_MS,
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
  getRemainingResendSeconds,
  isVerificationLocked,
} from '@/domain/email-verification.policy';
import { generateOTP } from './credentials';

/**
 * Verifies the user's email using the 6-digit OTP.
 */
export async function verifyEmail(userId: string, otp: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  if (user.emailVerified) {
    return { emailVerified: true, message: 'Email is already verified.' };
  }

  if (isVerificationLocked(user.emailVerificationLockedUntil)) {
    throw new Error('Too many incorrect codes. Verification is temporarily locked for 15 minutes.');
  }

  if (!user.emailVerificationToken || !user.emailVerificationExpiry) {
    throw new Error('No verification code found. Please request a new one.');
  }

  // Check if OTP has expired
  if (new Date() > user.emailVerificationExpiry) {
    throw new Error('Verification code has expired. Please request a new one.');
  }

  // Compare OTP hash
  const isValid = await bcrypt.compare(otp, user.emailVerificationToken);
  if (!isValid) {
    const failedAttempt = await prisma.user.update({
      where: { id: userId },
      data: { emailVerificationFailedAttempts: { increment: 1 } },
      select: { emailVerificationFailedAttempts: true },
    });
    if (failedAttempt.emailVerificationFailedAttempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          emailVerificationLockedUntil: new Date(Date.now() + EMAIL_VERIFICATION_LOCK_MS),
        },
      });
      throw new Error('Too many incorrect codes. Verification is temporarily locked for 15 minutes.');
    }
    throw new Error('Invalid verification code. Please check and try again.');
  }

  // Mark email as verified and clear token fields
  const verified = await prisma.user.updateMany({
    where: {
      id: userId,
      email: user.email,
      emailVerificationToken: user.emailVerificationToken,
      emailVerificationExpiry: { gt: new Date() },
      emailVerified: false,
    },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
      emailVerificationFailedAttempts: 0,
      emailVerificationLockedUntil: null,
    },
  });

  if (verified.count !== 1) throw new Error('Verification details changed. Request a new code.');

  return { emailVerified: true, message: 'Email verified successfully.' };
}

/**
 * Resends a new verification OTP to the user's email.
 */
export async function resendVerification(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found.');
  }

  if (user.emailVerified) {
    return { message: 'Email is already verified.' };
  }

  if (isVerificationLocked(user.emailVerificationLockedUntil)) {
    throw new Error('Verification is temporarily locked. Please try again after 15 minutes.');
  }

  const remainingSeconds = getRemainingResendSeconds(user.emailVerificationLastSentAt);
  if (remainingSeconds > 0) {
    throw new Error(`Please wait ${remainingSeconds} seconds before requesting another code.`);
  }

  // Generate new OTP
  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000);

  const sent = await prisma.user.updateMany({
    where: {
      id: userId,
      email: user.email,
      emailVerified: false,
      emailVerificationToken: user.emailVerificationToken,
    },
    data: {
      emailVerificationToken: otpHash,
      emailVerificationExpiry: otpExpiry,
      emailVerificationFailedAttempts: 0,
      emailVerificationLockedUntil: null,
      emailVerificationLastSentAt: new Date(),
    },
  });

  if (sent.count !== 1) throw new Error('Verification details changed. Request a new code.');

  await sendVerificationEmail(user.email, otp, user.name);

  return { message: 'A new verification code has been sent to your email.' };
}

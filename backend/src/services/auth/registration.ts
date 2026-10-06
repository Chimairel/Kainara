import bcrypt from 'bcryptjs';

import prisma from '@/lib/prisma';
import { signAccessToken } from '@/lib/jwt';
import { JWTPayload } from '@/types';
import { sendVerificationEmail } from '@/lib/email';

import { generateOTP } from './credentials';

import { createRefreshSession } from './sessions';

/**
 * Registers a brand-new user into the system.
 * Creates user with emailVerified=false, generates OTP, and sends verification email.
 */
export async function register(name: string, email: string, password: string) {
  const sanitizedEmail = email.trim().toLowerCase();

  // Check if the user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: sanitizedEmail },
  });

  if (existingUser) {
    throw new Error('An account with this email address already exists.');
  }

  // Hash the password with 12 salt rounds for strong security
  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(password, salt);

  // Generate email verification OTP
  const otp = generateOTP();
  const otpHash = await bcrypt.hash(otp, 10);
  const otpExpiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

  // Create User record in the database
  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: sanitizedEmail,
      passwordHash,
      role: 'USER',
      emailVerified: false,
      emailVerificationToken: otpHash,
      emailVerificationExpiry: otpExpiry,
      emailVerificationLastSentAt: new Date(),
    },
  });

  // Send verification email (non-blocking — don't crash registration if email fails)
  let verificationEmailSent = true;
  try {
    await sendVerificationEmail(sanitizedEmail, otp, name.trim());
  } catch (_emailError) {
    verificationEmailSent = false;
    console.error('[AuthService] Verification email delivery failed; the user may request another code.');
  }

  // Create the session payload
  const payload: JWTPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  // Generate tokens (user gets tokens immediately but must verify email to proceed)
  const accessToken = signAccessToken(payload);
  const refreshToken = await createRefreshSession(user.id, payload);

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
    verificationEmailSent,
  };
}

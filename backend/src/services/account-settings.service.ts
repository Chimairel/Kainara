import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { sendVerificationEmail } from '@/lib/email';
import { AppError } from '@/errors/AppError';

const inputSchema = z.object({
  name: z.string().trim().min(1).max(161).optional(),
  email: z.string().trim().toLowerCase().max(254).email().optional(),
  currentPassword: z.string().min(1).max(128).optional(),
  newPassword: z
    .string()
    .regex(/^(?=.*[A-Z])(?=.*\d)[^\u0000-\u001F\u007F]{8,128}$/u)
    .optional(),
});

/** Account identity changes and refresh revocation commit together. Mail is sent after commit. */
export async function updateAccountSettings(userId: string, body: unknown) {
  const parsed = inputSchema.safeParse(body);
  if (!parsed.success)
    throw new AppError(
      'Provide a valid name, email and password (8–128 characters, uppercase letter and number).',
      400,
      'INVALID_ACCOUNT_SETTINGS'
    );
  const input = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError('User not found.', 404, 'USER_NOT_FOUND');
  const passwordChanged = input.currentPassword !== undefined || input.newPassword !== undefined;
  if (passwordChanged) {
    if (!user.passwordLoginEnabled)
      throw new AppError(
        'This account uses Google sign-in and does not have a KAINARA password.',
        400,
        'PASSWORD_LOGIN_DISABLED'
      );
    if (!input.currentPassword || !input.newPassword)
      throw new AppError('Both current password and new password are required.', 400, 'PASSWORD_REQUIRED');
    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash)))
      throw new AppError('Incorrect current password.', 400, 'INCORRECT_PASSWORD');
  }
  const emailChanged = input.email !== undefined && input.email !== user.email;
  const otp = emailChanged ? randomInt(100000, 999999).toString() : null;
  const [otpHash, passwordHash] = await Promise.all([
    otp ? bcrypt.hash(otp, 10) : null,
    passwordChanged ? bcrypt.hash(input.newPassword!, 12) : null,
  ]);
  let updated;
  try {
    updated = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: userId } });
        if (
          !current ||
          current.email !== user.email ||
          current.passwordHash !== user.passwordHash ||
          current.isSuspended ||
          current.passwordLoginEnabled !== user.passwordLoginEnabled
        )
          throw new AppError('Account changed while saving. Reload and try again.', 409, 'ACCOUNT_CHANGED');
        const saved = await tx.user.update({
          where: { id: userId },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(emailChanged
              ? {
                  email: input.email,
                  emailVerified: false,
                  emailVerificationToken: otpHash,
                  emailVerificationExpiry: new Date(Date.now() + 15 * 60_000),
                  emailVerificationLastSentAt: new Date(),
                  emailVerificationFailedAttempts: 0,
                  emailVerificationLockedUntil: null,
                }
              : {}),
            ...(passwordHash ? { passwordHash } : {}),
            ...(emailChanged || passwordChanged ? { passwordResetToken: null, passwordResetExpiry: null } : {}),
          },
          select: { id: true, name: true, email: true, role: true, onboardingDone: true, emailVerified: true },
        });
        if (passwordChanged) await tx.session.deleteMany({ where: { userId } });
        return saved;
      },
      { maxWait: 10_000, timeout: 30_000 }
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      throw new AppError('An account with this email address already exists.', 400, 'EMAIL_ALREADY_USED');
    throw error;
  }
  let verificationEmailSent = false;
  if (otp) {
    try {
      await sendVerificationEmail(updated.email, otp, updated.name);
      verificationEmailSent = true;
    } catch {
      // The new inbox remains unverified even when delivery fails; verification can resend.
      console.error('[AccountSettings] Verification delivery failed; the new inbox remains unverified.');
    }
  }
  return { user: updated, emailChanged, passwordChanged, verificationEmailSent };
}

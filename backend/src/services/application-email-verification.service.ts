import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { AppError } from '@/errors/AppError';
import { sendVerificationEmail } from '@/lib/email';

export const normalizeApplicantEmail = (email: string) => email.trim().toLowerCase();
const digest = (token: string) => crypto.createHash('sha256').update(token).digest('hex');

/** An inbox challenge is independent of an account or a professional credential. */
export class ApplicationEmailVerificationService {
  static async send(address: string) {
    const email = normalizeApplicantEmail(address);
    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`applicant-otp:${email}`}, 0))`;
      const previous = await tx.applicationEmailVerification.findUnique({ where: { email } });
      const now = new Date();
      if (previous && now.getTime() - previous.sentAt.getTime() < 60_000)
        throw new AppError('Wait one minute before requesting another code.', 429, 'EMAIL_CODE_COOLDOWN');
      const sameWindow = previous && now.getTime() - previous.windowStartedAt.getTime() < 3600_000;
      if (sameWindow && previous.sendCount >= 5)
        throw new AppError('Too many codes requested for this address. Try again in an hour.', 429, 'EMAIL_CODE_LIMIT');
      const data = {
        codeHash,
        expiresAt: new Date(now.getTime() + 15 * 60_000),
        attempts: 0,
        sentAt: now,
        sendCount: sameWindow ? previous.sendCount + 1 : 1,
        windowStartedAt: sameWindow ? previous.windowStartedAt : now,
        proofHash: null,
        verifiedUntil: null,
      };
      await tx.applicationEmailVerification.upsert({ where: { email }, create: { email, ...data }, update: data });
    });
    // Never return the code through the API. Test mail capture is restricted to NODE_ENV=test.
    try {
      await sendVerificationEmail(email, code, 'Nutritionist applicant', 'application');
    } catch {
      throw new AppError(
        'The verification email could not be sent. Please try again shortly.',
        503,
        'EMAIL_DELIVERY_FAILED'
      );
    }
    return { expiresInSeconds: 900, resendAfterSeconds: 60 };
  }

  static async verify(address: string, code: string) {
    const email = normalizeApplicantEmail(address);
    const proof = crypto.randomBytes(32).toString('base64url');
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`applicant-otp:${email}`}, 0))`;
      const row = await tx.applicationEmailVerification.findUnique({ where: { email } });
      if (!row || row.expiresAt <= new Date() || row.attempts >= 5 || row.proofHash) return false;
      if (!(await bcrypt.compare(code, row.codeHash))) {
        await tx.applicationEmailVerification.update({ where: { email }, data: { attempts: { increment: 1 } } });
        return false; // Commit the failed attempt before throwing outside the transaction.
      }
      await tx.applicationEmailVerification.update({
        where: { email },
        data: {
          proofHash: digest(proof),
          verifiedUntil: new Date(Date.now() + 30 * 60_000),
        },
      });
      return true;
    });
    if (!result)
      throw new AppError('The code is invalid or expired. Request a new code if needed.', 400, 'EMAIL_CODE_INVALID');
    return { proof, expiresInSeconds: 1800 };
  }

  static async consume(tx: Prisma.TransactionClient, address: string, proof: string) {
    const email = normalizeApplicantEmail(address);
    const changed = await tx.applicationEmailVerification.updateMany({
      where: {
        email,
        proofHash: digest(proof),
        verifiedUntil: { gt: new Date() },
      },
      data: { proofHash: null, verifiedUntil: null, expiresAt: new Date(0) },
    });
    if (changed.count !== 1)
      throw new AppError(
        'Verify this email address before submitting your application.',
        422,
        'APPLICANT_EMAIL_UNVERIFIED'
      );
  }
}

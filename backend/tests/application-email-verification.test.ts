import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import prisma from '../src/lib/prisma';
import { ApplicationEmailVerificationService as Verification } from '../src/services/application-email-verification.service';

test('applicant OTP attempts persist, proofs bind the address, and consumption is single-use', async () => {
  const original = prisma.$transaction;
  const row = {
    email: 'applicant@example.invalid',
    codeHash: await bcrypt.hash('123456', 4),
    attempts: 0,
    expiresAt: new Date(Date.now() + 900_000),
    proofHash: null as string | null,
    verifiedUntil: null as Date | null,
  };
  const tx = {
    $executeRaw: async () => 1,
    applicationEmailVerification: {
      findUnique: async ({ where }: any) => (where.email === row.email ? { ...row } : null),
      update: async ({ data }: any) => {
        if (data.attempts) row.attempts++;
        else Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: any) => {
        if (
          row.email !== where.email ||
          row.proofHash !== where.proofHash ||
          !row.verifiedUntil ||
          row.verifiedUntil <= where.verifiedUntil.gt
        )
          return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
  };
  prisma.$transaction = (async (work: any) => work(tx)) as typeof original;
  try {
    await assert.rejects(() => Verification.verify(row.email, '000000'));
    assert.equal(row.attempts, 1);
    const result = await Verification.verify(' Applicant@example.invalid ', '123456');
    assert.equal(result.proof.length, 43);
    await assert.rejects(() => Verification.verify(row.email, '123456'), 'A verified OTP cannot issue another proof.');
    await assert.rejects(() => Verification.consume(tx as any, 'mistyped@example.invalid', result.proof));
    await Verification.consume(tx as any, row.email, result.proof);
    await assert.rejects(() => Verification.consume(tx as any, row.email, result.proof));
    row.expiresAt = new Date(Date.now() + 900_000);
    row.attempts = 5;
    await assert.rejects(() => Verification.verify(row.email, '123456'));
    row.attempts = 0;
    row.expiresAt = new Date(0);
    await assert.rejects(() => Verification.verify(row.email, '123456'));
  } finally {
    prisma.$transaction = original;
    await prisma.$disconnect();
  }
});

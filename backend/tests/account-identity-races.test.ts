import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { AppError } from '../src/errors/AppError';

process.env.JWT_SECRET ||= 'identity-race-test-only-access';
process.env.JWT_REFRESH_SECRET ||= 'identity-race-test-only-refresh';

test('account identity race protections', async (parent) => {
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  globals.prisma = {
    user: { findUnique: async () => null, updateMany: async () => ({ count: 0 }) },
    $transaction: async () => {
      throw new Error('Unexpected transaction');
    },
  };
  parent.after(() => {
    globals.prisma = previous;
  });
  const { default: prisma } = await import('../src/lib/prisma');
  const { updateAccountSettings } = await import('../src/services/account-settings.service');
  await parent.test('malformed credential settings are rejected before a database mutation', async (context) => {
    context.mock.method(prisma.user, 'findUnique', async () => assert.fail('invalid input must not read accounts'));
    for (const body of [{ email: 'broken' }, { email: null }, { currentPassword: {} }, { newPassword: 'weak' }])
      await assert.rejects(
        () => updateAccountSettings('fixture', body),
        (error: unknown) => error instanceof AppError && error.statusCode === 400
      );
  });

  await parent.test(
    'an in-flight credential change cannot overwrite another committed password change',
    async (context) => {
      const passwordHash = await bcrypt.hash('Current123!', 4);
      const before = { id: 'fixture', email: 'person@example.test', passwordLoginEnabled: true, passwordHash };
      context.mock.method(prisma.user, 'findUnique', async () => before);
      const transaction = {
        $queryRaw: async () => [],
        user: {
          findUnique: async () => ({ ...before, passwordHash: 'changed-after-password-check' }),
          update: async () => assert.fail('stale credential write must not commit'),
        },
        session: { deleteMany: async () => assert.fail('failed writes must not revoke sessions') },
      };
      context.mock.method(prisma, '$transaction', async (work: (tx: unknown) => Promise<unknown>) => work(transaction));
      await assert.rejects(
        () => updateAccountSettings('fixture', { currentPassword: 'Current123!', newPassword: 'Changed123!' }),
        (error: unknown) => error instanceof AppError && error.errorCode === 'ACCOUNT_CHANGED'
      );
    }
  );

  await parent.test('an old inbox OTP cannot verify an account changed while proof was checked', async (context) => {
    const { AuthService } = await import('../src/services/auth.service');
    const hash = await bcrypt.hash('123456', 4);
    context.mock.method(prisma.user, 'findUnique', async () => ({
      id: 'fixture',
      email: 'old@example.test',
      emailVerified: false,
      emailVerificationToken: hash,
      emailVerificationExpiry: new Date(Date.now() + 60_000),
      emailVerificationLockedUntil: null,
    }));
    context.mock.method(prisma.user, 'updateMany', async (args: any) => {
      assert.equal(args.where.email, 'old@example.test');
      assert.equal(args.where.emailVerificationToken, hash);
      assert.equal(args.where.emailVerified, false);
      return { count: 0 }; // The persisted inbox/token no longer matches this proof.
    });
    await assert.rejects(() => AuthService.verifyEmail('fixture', '123456'), /Verification details changed/);
  });

  await parent.test('resending proof for an old inbox cannot replace the changed inbox token', async (context) => {
    const { AuthService } = await import('../src/services/auth.service');
    context.mock.method(prisma.user, 'findUnique', async () => ({
      id: 'fixture',
      name: 'Fixture',
      email: 'old@example.test',
      emailVerified: false,
      emailVerificationToken: 'old-token',
      emailVerificationLastSentAt: null,
      emailVerificationLockedUntil: null,
    }));
    context.mock.method(prisma.user, 'updateMany', async (args: any) => {
      assert.equal(args.where.email, 'old@example.test');
      assert.equal(args.where.emailVerificationToken, 'old-token');
      assert.equal(args.where.emailVerified, false);
      return { count: 0 };
    });
    await assert.rejects(() => AuthService.resendVerification('fixture'), /Verification details changed/);
  });

  await parent.test(
    'password recovery for an old inbox cannot issue proof after the account changes',
    async (context) => {
      const { AuthService } = await import('../src/services/auth.service');
      context.mock.method(prisma.user, 'findUnique', async () => ({
        id: 'fixture',
        name: 'Fixture',
        email: 'old@example.test',
        role: 'USER',
        passwordLoginEnabled: true,
        passwordHash: 'before-change',
      }));
      context.mock.method(prisma.user, 'updateMany', async (args: any) => {
        assert.equal(args.where.email, 'old@example.test');
        assert.equal(args.where.passwordHash, 'before-change');
        assert.equal(args.where.passwordLoginEnabled, true);
        return { count: 0 };
      });
      const result = await AuthService.forgotPassword('old@example.test');
      assert.match(result.message, /^If an account/);
    }
  );

  await parent.test(
    'password login checked before a credential change cannot create a refresh session afterward',
    async (context) => {
      const { AuthService } = await import('../src/services/auth.service');
      const passwordHash = await bcrypt.hash('Current123!', 4);
      const before = {
        id: 'fixture',
        email: 'person@example.test',
        role: 'USER',
        isSuspended: false,
        passwordLoginEnabled: true,
        passwordHash,
      };
      context.mock.method(prisma.user, 'findUnique', async () => before);
      const transaction = {
        $queryRaw: async () => [],
        user: { findUnique: async () => ({ ...before, passwordHash: 'changed-after-check' }) },
        session: { create: async () => assert.fail('old credentials must not create a new session') },
      };
      context.mock.method(prisma, '$transaction', async (work: (tx: unknown) => Promise<unknown>) => work(transaction));
      await assert.rejects(() => AuthService.login(before.email, 'Current123!'), /credentials changed/);
    }
  );
});

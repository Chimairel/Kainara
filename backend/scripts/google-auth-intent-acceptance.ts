import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mock } from 'node:test';
import { OAuth2Client } from 'google-auth-library';
import prisma from '../src/lib/prisma';
import AuthService, { GoogleAuthFlowError, type VerifiedGoogleIdentity } from '../src/services/auth.service';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(
    process.env.NUTRIMIND_ALLOW_DISPOSABLE_DB_TEST,
    'true',
    'Explicit disposable database test opt-in required'
  );
  assert.equal(target.hostname, '127.0.0.1', 'This fixture must only run against local disposable PostgreSQL');
  assert.equal(target.pathname, '/kainara_google', 'Unexpected disposable database name');
  const marker = randomUUID();
  const identity: VerifiedGoogleIdentity = {
    email: `google-intent-${marker}@example.test`,
    sub: `google-sub-${marker}`,
    given_name: 'Google',
    family_name: 'Fixture',
  };

  let createdUserId: string | null = null;
  try {
    await assert.rejects(
      () => AuthService.completeGoogleAuth(identity, 'LOGIN'),
      (error: unknown) => error instanceof GoogleAuthFlowError && error.code === 'ACCOUNT_NOT_FOUND'
    );
    assert.equal(await prisma.user.count({ where: { email: identity.email } }), 0);

    // Exercise real database uniqueness and session persistence with fixture provider claims.
    // Token cryptography is tested separately; no real Google/provider requests are made here.
    mock.method(
      OAuth2Client.prototype,
      'verifyIdToken',
      async () =>
        ({
          getPayload: () => ({ ...identity, email_verified: true }),
        }) as any
    );
    const continuations = await Promise.all([
      AuthService.googleContinue('fixture-token'),
      AuthService.googleContinue('fixture-token'),
      AuthService.googleContinue('fixture-token'),
    ]);
    const registration = continuations[0];
    assert.ok(continuations.every((result) => result.user.id === registration.user.id));
    assert.equal(await prisma.user.count({ where: { email: identity.email } }), 1);
    createdUserId = registration.user.id;
    const created = await prisma.user.findUniqueOrThrow({
      where: { id: createdUserId },
      include: { accounts: true, sessions: true },
    });
    assert.equal(created.emailVerified, true);
    assert.equal(created.passwordLoginEnabled, false);
    assert.equal(created.onboardingDone, false);
    assert.equal(created.accounts.length, 1);
    assert.equal(created.accounts[0].provider, 'google');
    assert.equal(created.accounts[0].providerAccountId, identity.sub);
    assert.equal(created.accounts[0].access_token, null);
    assert.equal(created.sessions.length, 3);

    await AuthService.forgotPassword(identity.email);
    const afterRecoveryAttempt = await prisma.user.findUniqueOrThrow({ where: { id: createdUserId } });
    assert.equal(afterRecoveryAttempt.passwordResetToken, null);
    assert.equal(afterRecoveryAttempt.passwordResetExpiry, null);

    await assert.rejects(
      () => AuthService.completeGoogleAuth(identity, 'REGISTER'),
      (error: unknown) => error instanceof GoogleAuthFlowError && error.code === 'ACCOUNT_EXISTS'
    );

    const returning = await AuthService.completeGoogleAuth(identity, 'CONTINUE');
    assert.equal(returning.user.id, createdUserId);
    const login = await AuthService.completeGoogleAuth(identity, 'LOGIN');
    assert.equal(login.user.id, createdUserId);
    assert.equal(await prisma.account.count({ where: { userId: createdUserId, provider: 'google' } }), 1);
    assert.equal(await prisma.session.count({ where: { userId: createdUserId } }), 5);

    console.log(
      JSON.stringify(
        {
          pass: true,
          missingLoginDidNotProvision: true,
          firstContinuationCreatedAccount: true,
          concurrentContinuationsSharedOneAccount: true,
          returningContinuationReusedAccount: true,
          googleRegistrationHasNoPasswordLogin: true,
          googleOnlyRecoveryDidNotIssueToken: true,
          googleLinkPersistedWithoutPicture: true,
          repeatRegistrationRejected: true,
          existingAccountLoginSucceeded: true,
        },
        null,
        2
      )
    );
  } finally {
    mock.restoreAll();
    if (createdUserId) await prisma.user.deleteMany({ where: { id: createdUserId } });
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

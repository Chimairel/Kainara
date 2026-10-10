import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { assertNewPassword, newPasswordSchema } from '../src/validation/password.schemas';
import { nutritionistInvitationAcceptanceSchema } from '../src/validation/nutritionist-application.schemas';

test('new passwords reject bcrypt truncation including multibyte input', async () => {
  const prefix = 'A1' + 'x'.repeat(70);
  const hash = await bcrypt.hash(prefix + 'first', 4);
  // Regression: distinct passwords were previously indistinguishable.
  assert.equal(await bcrypt.compare(prefix + 'second', hash), true);
  assert.equal(newPasswordSchema.safeParse(prefix).success, true);
  assert.equal(newPasswordSchema.safeParse(prefix + 'first').success, false);
  assert.equal(newPasswordSchema.safeParse(prefix + 'second').success, false);
  assert.equal(newPasswordSchema.safeParse('A1' + 'é'.repeat(35)).success, true);
  assert.equal(newPasswordSchema.safeParse('A1' + 'é'.repeat(36)).success, false);
  assert.equal(newPasswordSchema.safeParse('A1' + '😀'.repeat(17) + 'xx').success, true);
  assert.equal(newPasswordSchema.safeParse('A1' + '😀'.repeat(18)).success, false);
  assert.throws(() => assertNewPassword(prefix + 'suffix'), /too long/);
  assert.equal(
    nutritionistInvitationAcceptanceSchema.safeParse({ token: 'fixture-invitation', password: prefix + 'suffix' })
      .success,
    false
  );
});

test('every public password-write service rejects truncation before database access', async (context) => {
  process.env.JWT_SECRET ||= 'password-boundary-test-access';
  process.env.JWT_REFRESH_SECRET ||= 'password-boundary-test-refresh';
  const globals = globalThis as unknown as { prisma: unknown };
  const previous = globals.prisma;
  globals.prisma = new Proxy({}, { get: () => assert.fail('Invalid passwords must not access the database') });
  context.after(() => {
    globals.prisma = previous;
  });
  const { register } = await import('../src/services/auth/registration');
  const { resetPassword } = await import('../src/services/auth/password-auth');
  const { updateAccountSettings } = await import('../src/services/account-settings.service');
  const { NutritionistApplicationService } = await import('../src/services/nutritionist-application.service');
  const password = 'A1' + 'x'.repeat(71);
  for (const write of [
    () => register('Fixture User', 'fixture@example.test', password),
    () => resetPassword('fixture-token', password),
    () => updateAccountSettings('fixture-user', { currentPassword: 'Current123!', newPassword: password }),
    () => NutritionistApplicationService.acceptInvitation('fixture-token', password),
  ])
    await assert.rejects(write, /too long/);
});

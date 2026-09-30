import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import nodemailer from 'nodemailer';
import { EMAIL_REQUEST_TIMEOUT_MS, sendTransactionalEmail, verifyEmailTransport } from '../src/lib/email-transport';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendNutritionistInvitationEmail,
  sendNutritionistCallScheduledEmail,
  sendNutritionistApplicationSubmittedEmail,
  sendNutritionistApplicationRejectedEmail,
} from '../src/lib/email';

function configureBrevo(t: TestContext) {
  const previous = { ...process.env };
  Object.assign(process.env, {
    EMAIL_PROVIDER: 'brevo',
    BREVO_API_KEY: 'test-only-provider-key',
    EMAIL_FROM: 'sender@example.com',
    FRONTEND_URL: 'https://demo.example.com',
  });
  delete process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH;
  t.after(() => {
    process.env = previous;
  });
}

test('all six operational emails use the shared HTTPS transport and final frontend links', async (t) => {
  configureBrevo(t);
  const messages: { subject: string; htmlContent: string; sender: { email: string }; to: { email: string }[] }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: unknown, init: RequestInit) => {
    assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    assert.equal(new Headers(init.headers).get('api-key'), 'test-only-provider-key');
    assert.ok(init.signal);
    messages.push(JSON.parse(String(init.body)));
    return Response.json({ messageId: 'accepted-test-id' }, { status: 201 });
  });
  await sendVerificationEmail('recipient@example.com', '123456', '<Test User>');
  await sendPasswordResetEmail('recipient@example.com', 'reset-token', 'Test User');
  await sendNutritionistInvitationEmail('recipient@example.com', 'invite-token', 'Test RND');
  await sendNutritionistCallScheduledEmail({
    to: 'recipient@example.com',
    applicantName: 'Test RND',
    referenceCode: 'NM-test',
    scheduledCallAt: new Date('2026-10-01T10:00:00Z'),
    meetingUrl: 'https://meet.example.com/test',
  });
  await sendNutritionistApplicationSubmittedEmail('recipient@example.com', 'Test RND', 'NM-test');
  await sendNutritionistApplicationRejectedEmail('recipient@example.com', 'Test RND', 'NM-test', 'Test explanation');
  assert.equal(messages.length, 6);
  for (const message of messages) {
    assert.equal(message.sender.email, 'sender@example.com');
    assert.deepEqual(message.to, [{ email: 'recipient@example.com' }]);
    assert.ok(message.subject.startsWith('KAINARA'));
    assert.ok(message.htmlContent.startsWith('<!DOCTYPE html>'));
    assert.ok(!message.htmlContent.includes('localhost'));
  }
  assert.ok(messages[0].htmlContent.includes('&lt;Test User&gt;'));
  assert.ok(messages[1].htmlContent.includes('https://demo.example.com/reset-password?token=reset-token'));
  assert.ok(messages[2].htmlContent.includes('https://demo.example.com/nutritionist-invitation?token=invite-token'));
});

test('Brevo configuration check sends no startup mail and does not require SMTP', async (t) => {
  configureBrevo(t);
  t.mock.method(globalThis, 'fetch', () => assert.fail('configuration checks must not send mail'));
  assert.equal(await verifyEmailTransport(), true);
  delete process.env.BREVO_API_KEY;
  assert.equal(await verifyEmailTransport(), false);
  await assert.rejects(
    () => sendTransactionalEmail({ to: 'recipient@example.com', subject: 'Test', html: 'Test' }),
    /BREVO_API_KEY/
  );
});

test('provider failure or malformed acceptance is surfaced without retries or sensitive response data', async (t) => {
  configureBrevo(t);
  const responses = [
    Response.json({ secret: 'must-not-leak' }, { status: 401 }),
    Response.json({}, { status: 201 }),
    new Response('bad JSON', { status: 201 }),
  ];
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => responses[calls++]);
  for (let index = 0; index < responses.length; index++) {
    await assert.rejects(
      () => sendTransactionalEmail({ to: 'recipient@example.com', subject: 'Test', html: 'Test' }),
      (error) =>
        error instanceof Error &&
        error.message.startsWith('Email delivery was not confirmed.') &&
        !error.message.includes('must-not-leak')
    );
    assert.equal(calls, index + 1);
  }
});

test('HTTPS requests carry a bounded abort deadline and timeout failures settle', async (t) => {
  configureBrevo(t);
  t.mock.method(AbortSignal, 'timeout', (milliseconds: number) => {
    assert.equal(milliseconds, EMAIL_REQUEST_TIMEOUT_MS);
    return AbortSignal.abort(new Error('synthetic timeout'));
  });
  t.mock.method(globalThis, 'fetch', async (_url: unknown, init: RequestInit) => {
    assert.ok(init.signal?.aborted);
    throw init.signal.reason;
  });
  await assert.rejects(
    () => sendVerificationEmail('recipient@example.com', '123456', 'Test'),
    /email provider configuration/
  );
});

test('existing SMTP delivery remains available with secure port 465 and bounded connections', async (t) => {
  const previous = { ...process.env };
  Object.assign(process.env, {
    EMAIL_PROVIDER: 'smtp',
    SMTP_PORT: '465',
    SMTP_USER: 'sender@example.com',
    SMTP_PASS: 'test-only-password',
    EMAIL_FROM: 'sender@example.com',
  });
  t.after(() => {
    process.env = previous;
  });
  let calls = 0;
  t.mock.method(nodemailer, 'createTransport', (options: { secure: boolean; connectionTimeout: number }) => {
    assert.equal(options.secure, true);
    assert.equal(options.connectionTimeout, EMAIL_REQUEST_TIMEOUT_MS);
    return {
      sendMail: async (message: { to: string; from: string }) => {
        assert.equal(message.to, 'recipient@example.com');
        assert.equal(message.from, '"KAINARA" <sender@example.com>');
        calls++;
      },
      verify: async () => true,
    };
  });
  await sendTransactionalEmail({ to: 'recipient@example.com', subject: 'Test', html: 'Test' });
  assert.equal(calls, 1);
  assert.equal(await verifyEmailTransport(), true);
});

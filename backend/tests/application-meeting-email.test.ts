import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import prisma from '../src/lib/prisma';
import { NutritionistApplicationService as Applications } from '../src/services/nutritionist-application.service';

test('meeting mail includes the schedule and room; failure is reported without losing the schedule', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'kainara-meeting-test-'));
  const capture = path.join(directory, 'mail.jsonl');
  const env = { mode: process.env.NODE_ENV, capture: process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH };
  const original = {
    transaction: prisma.$transaction,
    update: prisma.nutritionistApplication.update,
    audit: prisma.auditEvent.create,
  };
  const row: any = {
    id: 'synthetic-application',
    status: 'CALL_SCHEDULED',
    fullName: 'Test Applicant',
    email: 'applicant@example.invalid',
    referenceCode: 'NM-TEST',
    scheduledCallAt: new Date('2030-01-01T02:00:00Z'),
    meetingUrl: 'https://meet.google.com/test-room',
    callVerifiedAt: null,
    callEmailAttemptedAt: null,
    callEmailSentAt: null,
  };
  const update = async ({ data }: any) => {
    Object.assign(row, data);
    return row;
  };
  const tx = {
    $executeRaw: async () => 1,
    nutritionistApplication: { findUniqueOrThrow: async () => ({ ...row }), update },
  };
  prisma.$transaction = (async (work: any) => work(tx)) as typeof original.transaction;
  prisma.nutritionistApplication.update = update as any;
  prisma.auditEvent.create = (async () => ({})) as any;
  try {
    process.env.NODE_ENV = 'test';
    process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = capture;
    assert.equal((await Applications.sendCallReminder('admin', row.id)).callEmailSent, true);
    const mail = JSON.parse((await readFile(capture, 'utf8')).trim());
    assert.equal(mail.type, 'NUTRITIONIST_CALL_SCHEDULED');
    assert.equal(mail.to, row.email);
    assert.equal(mail.metadata.meetingUrl, row.meetingUrl);
    assert.equal(mail.metadata.scheduledCallAt, row.scheduledCallAt.toISOString());
    await assert.rejects(() => Applications.sendCallReminder('admin', row.id), /Wait one minute/);
    // Capture rejects outside test mode before it reaches an external mail provider.
    process.env.NODE_ENV = 'production';
    row.callEmailAttemptedAt = new Date(0);
    row.callEmailSentAt = null;
    assert.equal((await Applications.sendCallReminder('admin', row.id)).callEmailSent, false);
    assert.equal(row.status, 'CALL_SCHEDULED');
    assert.equal(row.callEmailSentAt, null);
  } finally {
    prisma.$transaction = original.transaction;
    prisma.nutritionistApplication.update = original.update;
    prisma.auditEvent.create = original.audit;
    if (env.mode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = env.mode;
    if (env.capture === undefined) delete process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH;
    else process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = env.capture;
    await unlink(capture);
    await rmdir(directory);
    await prisma.$disconnect();
  }
});

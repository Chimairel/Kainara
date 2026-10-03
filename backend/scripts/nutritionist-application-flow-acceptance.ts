import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';

type ApiResult = { status: number; data: any };

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55465');
  assert.equal(target.pathname, '/nutrimind_ui_tests');
  assert.equal(process.env.NODE_ENV, 'test');
  const mailPath = path.join(await mkdtemp(path.join(tmpdir(), 'nutritionist-application-')), 'mail.jsonl');
  process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH = mailPath;
  process.env.SMTP_VERIFY_ON_STARTUP = 'false';

  const { default: app } = await import('../src/app');
  const { default: prisma } = await import('../src/lib/prisma');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { AuthService } = await import('../src/services/auth.service');
  const { NutritionistApplicationService: applications } =
    await import('../src/services/nutritionist-application.service');
  const { ApplicationEmailVerificationService: inbox } =
    await import('../src/services/application-email-verification.service');
  const { NotificationService } = await import('../src/services/notification.service');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}/api`;
  const stamp = Date.now();
  const applicantEmail = `applicant-${stamp}@example.test`;
  const rejectedEmail = `rejected-${stamp}@example.test`;
  const password = 'JourneyPass123!';

  async function request(route: string, method = 'GET', body?: unknown, token?: string): Promise<ApiResult> {
    const response = await fetch(`${base}${route}`, {
      method,
      headers: {
        ...(body ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json() };
  }

  async function waitForMail(type: string, to: string, after = 0) {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        const messages = (await readFile(mailPath, 'utf8'))
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line));
        const matching = messages.filter((mail) => mail.type === type && mail.to === to);
        if (matching.length > after) return matching.at(-1);
      } catch {
        /* capture file is created when the first email is sent */
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Captured ${type} email did not arrive.`);
  }

  async function verifyInbox(address: string) {
    const email = address.toLowerCase();
    // Isolated fixture clock advance; the guarded database is never the shared Neon target.
    await prisma.applicationEmailVerification.updateMany({ where: { email }, data: { sentAt: new Date(0) } });
    await inbox.send(email);
    const mail = await waitForMail('EMAIL_VERIFICATION', email);
    return (await inbox.verify(email, mail.token)).proof;
  }
  async function applicationPayload(email: string, license: string) {
    return {
      emailVerificationProof: await verifyInbox(email),
      fullName: 'Synthetic Nutritionist',
      email,
      phoneNumber: '+63 917 555 0123',
      prcLicenseNumber: license,
      prcLicenseExpiry: '2029-12-31T23:59:59.000Z',
      specialization: 'Clinical nutrition',
      yearsOfExperience: 4,
      university: 'Synthetic University',
      professionalBio: 'Synthetic licensed professional used for an isolated application journey acceptance test.',
      officialHeadshot: 'data:image/jpeg;base64,/9j/AA==',
      photoRecentAttested: true as const,
      availableCallSlots: [new Date(Date.now() + 3600000).toISOString(), new Date(Date.now() + 7200000).toISOString()],
      consent: true as const,
    };
  }

  try {
    await prisma.user.create({
      data: {
        name: 'Synthetic Admin',
        email: `admin-${stamp}@example.test`,
        role: 'ADMIN',
        emailVerified: true,
        passwordHash: await bcrypt.hash(password, 12),
      },
    });
    const adminLogin = await request('/auth/login', 'POST', { email: `admin-${stamp}@example.test`, password });
    assert.equal(adminLogin.status, 200, JSON.stringify(adminLogin.data));
    const adminToken = adminLogin.data.data.accessToken as string;
    assert.equal((await request('/admin/nutritionist-applications')).status, 401);

    assert.equal((await request('/live/events')).status, 401, 'Live streams require authentication.');
    const streamAbort = new AbortController();
    const stream = await fetch(`${base}/live/events`, {
      headers: { authorization: `Bearer ${adminToken}` },
      signal: streamAbort.signal,
    });
    assert.equal(stream.status, 200);
    assert.match(stream.headers.get('content-type') ?? '', /text\/event-stream/);
    const reader = stream.body!.getReader();
    const decoder = new TextDecoder();
    const firstFrame = decoder.decode((await reader.read()).value);
    assert.equal(firstFrame, 'event: connected\ndata: {}\n\n');
    const liveFrame = reader.read();
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: `admin-${stamp}@example.test` } });
    assert.deepEqual(
      (await request('/nutritionist-applications/license-availability', 'POST', { prcLicenseNumber: `PRC-${stamp}` }))
        .data.data,
      { available: true }
    );
    const submitted = await request(
      '/nutritionist-applications',
      'POST',
      await applicationPayload(applicantEmail, `PRC-${stamp}`)
    );
    assert.equal(submitted.status, 201, JSON.stringify(submitted.data));
    assert.equal(submitted.data.data.status, 'SUBMITTED');
    const deadline = setTimeout(() => streamAbort.abort(), 5000);
    try {
      assert.equal(
        decoder.decode((await liveFrame).value),
        'event: refresh\ndata: {}\n\n',
        'New applications must reach the admin stream without private data.'
      );
    } finally {
      clearTimeout(deadline);
      streamAbort.abort();
      reader.releaseLock();
    }
    assert.equal(submitted.data.data.id, undefined, 'Public response must not expose the database ID.');
    assert.equal(await prisma.notification.count({ where: { userId: admin.id, type: 'NUTRITIONIST_APPLICATION' } }), 1);
    assert.deepEqual(
      (await request('/nutritionist-applications/license-availability', 'POST', { prcLicenseNumber: `prc-${stamp}` }))
        .data.data,
      { available: false }
    );
    const reference = submitted.data.data.referenceCode as string;
    const application = await prisma.nutritionistApplication.findUniqueOrThrow({ where: { referenceCode: reference } });
    assert.equal(
      (await request('/nutritionist-applications', 'POST', await applicationPayload(applicantEmail, `PRC-${stamp}`)))
        .status,
      400
    );
    assert.equal(
      await prisma.notification.count({ where: { userId: admin.id, type: 'NUTRITIONIST_APPLICATION' } }),
      1,
      'Duplicate attempts do not notify admins.'
    );
    assert.equal(
      (
        await request('/nutritionist-applications/status', 'POST', {
          referenceCode: reference,
          email: 'wrong@example.test',
        })
      ).status,
      404
    );
    assert.equal(
      (await request('/nutritionist-applications/status', 'POST', { referenceCode: reference, email: applicantEmail }))
        .data.data.status,
      'SUBMITTED'
    );
    await waitForMail('NUTRITIONIST_APPLICATION_SUBMITTED', applicantEmail);
    assert.equal((await request('/admin/nutritionist-applications', 'GET', undefined, adminToken)).status, 200);

    const route = `/admin/nutritionist-applications/${application.id}`;
    assert.equal((await request(`${route}/decision`, 'PATCH', { decision: 'approve' }, adminToken)).status, 400);
    assert.equal((await request(`${route}/stage`, 'PATCH', { status: 'UNDER_REVIEW' }, adminToken)).status, 200);
    assert.equal((await request(`${route}/stage`, 'PATCH', { status: 'CALL_REQUIRED' }, adminToken)).status, 200);
    const scheduledAt = new Date(Date.now() + 1200).toISOString();
    assert.equal(
      (
        await request(
          `${route}/schedule`,
          'PATCH',
          { scheduledCallAt: scheduledAt, meetingUrl: 'https://meet.example.test/verification' },
          adminToken
        )
      ).status,
      200
    );
    await waitForMail('NUTRITIONIST_CALL_SCHEDULED', applicantEmail);
    assert.equal(
      (await request(`${route}/call-verification`, 'PATCH', { identityMatched: true }, adminToken)).status,
      400,
      'Future call confirmation remains blocked by the server.'
    );
    assert.equal((await request(`${route}/decision`, 'PATCH', { decision: 'approve' }, adminToken)).status, 400);
    await new Promise((resolve) => setTimeout(resolve, 1400));
    assert.equal((await request(`${route}/decision`, 'PATCH', { decision: 'approve' }, adminToken)).status, 400);
    assert.equal(
      (await request(`${route}/call-verification`, 'PATCH', { identityMatched: true }, adminToken)).status,
      200
    );
    const approved = await request(`${route}/decision`, 'PATCH', { decision: 'approve' }, adminToken);
    assert.equal(approved.status, 200, JSON.stringify(approved.data));
    assert.equal(approved.data.data.invitationEmailSent, true);
    const invitation = await waitForMail('NUTRITIONIST_INVITATION', applicantEmail);
    const resend = await request(`${route}/resend-invitation`, 'POST', undefined, adminToken);
    assert.equal(resend.status, 200, JSON.stringify(resend.data));
    assert.equal(resend.data.data.invitationEmailSent, true);
    const replacementInvitation = await waitForMail('NUTRITIONIST_INVITATION', applicantEmail, 1);
    assert.notEqual(replacementInvitation.token, invitation.token);
    assert.equal(
      (await request('/nutritionist-applications/activate', 'POST', { token: invitation.token, password })).status,
      400
    );
    assert.equal(
      (await request('/nutritionist-applications/status', 'POST', { referenceCode: reference, email: applicantEmail }))
        .data.data.status,
      'APPROVED'
    );

    // A reset link must never turn an unaccepted invitation into workspace access.
    assert.equal((await request('/auth/forgot-password', 'POST', { email: applicantEmail })).status, 200);
    const resetMail = (await readFile(mailPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line))
      .find((mail) => mail.type === 'PASSWORD_RESET' && mail.to === applicantEmail);
    assert.equal(resetMail, undefined, 'Pending invite must not issue a password reset email.');
    const staleResetToken = `stale-reset-${stamp}`;
    await prisma.user.update({
      where: { id: approved.data.data.application.invitedUserId },
      data: {
        passwordResetToken: await bcrypt.hash(staleResetToken, 10),
        passwordResetExpiry: new Date(Date.now() + 60000),
      },
    });
    const reset = await request('/auth/reset-password', 'POST', { token: staleResetToken, password });
    assert.notEqual(reset.status, 200, 'Pending invite must not accept an older password reset token.');
    const preActivationLogin = await request('/auth/login', 'POST', { email: applicantEmail, password });
    assert.notEqual(preActivationLogin.status, 200, 'Pending invite must not sign in.');
    await assert.rejects(
      AuthService.completeGoogleAuth({ email: applicantEmail, sub: `google-${stamp}` }, 'LOGIN'),
      /Complete your nutritionist invitation/
    );
    assert.equal(await prisma.account.count({ where: { userId: approved.data.data.application.invitedUserId } }), 0);
    const unactivatedToken = signAccessToken({
      userId: approved.data.data.application.invitedUserId,
      email: applicantEmail,
      role: 'NUTRITIONIST',
    });
    assert.equal((await request('/nutritionist/profile', 'GET', undefined, unactivatedToken)).status, 403);

    const acceptAttempts = await Promise.all([
      request('/nutritionist-applications/activate', 'POST', { token: replacementInvitation.token, password }),
      request('/nutritionist-applications/activate', 'POST', {
        token: replacementInvitation.token,
        password: 'DifferentPass123!',
      }),
    ]);
    assert.deepEqual(
      acceptAttempts.map((attempt) => attempt.status).sort(),
      [200, 400],
      'Only one simultaneous activation may win.'
    );
    assert.equal(
      (await request('/nutritionist-applications/activate', 'POST', { token: replacementInvitation.token, password }))
        .status,
      400
    );
    assert.equal((await request(`${route}/resend-invitation`, 'POST', undefined, adminToken)).status, 400);
    const activatedPassword = acceptAttempts[0].status === 200 ? password : 'DifferentPass123!';
    const nutritionistLogin = await request('/auth/login', 'POST', {
      email: applicantEmail,
      password: activatedPassword,
    });
    assert.equal(nutritionistLogin.status, 200, JSON.stringify(nutritionistLogin.data));
    const nutritionistToken = nutritionistLogin.data.data.accessToken as string;
    const activatedUserId = approved.data.data.application.invitedUserId as string;
    const queueTitle = `Synthetic queue event ${stamp}`;
    const blockedReviewers: string[] = [];
    for (const [kind, profileVerified, suspended, emailVerified, expiry] of [
      ['unverified', false, false, true, '2029-12-31'],
      ['suspended', true, true, true, '2029-12-31'],
      ['expired', true, false, true, '2020-12-31'],
      ['email-unverified', true, false, false, '2029-12-31'],
    ] as const) {
      const blocked = await prisma.user.create({
        data: {
          passwordHash: await bcrypt.hash(password, 10),
          name: 'Synthetic blocked reviewer',
          email: `${kind}-${stamp}@example.test`,
          role: 'NUTRITIONIST',
          emailVerified,
          isSuspended: suspended,
          nutritionistProfile: {
            create: {
              prcLicenseNumber: `BLOCKED-${kind}-${stamp}`,
              prcLicenseExpiry: new Date(expiry),
              isVerified: profileVerified,
            },
          },
        },
      });
      blockedReviewers.push(blocked.id);
    }
    await NotificationService.notifyReviewers(queueTitle, 'A synthetic record is ready for review.');
    assert.equal(await prisma.notification.count({ where: { title: queueTitle, userId: activatedUserId } }), 1);
    assert.equal(
      await prisma.notification.count({ where: { title: queueTitle, userId: { in: blockedReviewers } } }),
      0,
      'Ineligible reviewers do not receive queue alerts.'
    );
    await assert.rejects(
      prisma.$transaction(async (tx) => {
        await NotificationService.notifyReviewers(`${queueTitle} rollback`, 'Synthetic rollback test.', tx);
        throw new Error('synthetic rollback');
      }),
      /synthetic rollback/
    );
    assert.equal(
      await prisma.notification.count({ where: { title: `${queueTitle} rollback` } }),
      0,
      'Queue notifications commit with the related operation.'
    );

    assert.equal((await request('/nutritionist/profile', 'GET', undefined, nutritionistToken)).status, 200);
    assert.equal((await request('/admin/nutritionist-applications', 'GET', undefined, nutritionistToken)).status, 403);
    assert.equal(
      (await request('/nutritionist-applications/status', 'POST', { referenceCode: reference, email: applicantEmail }))
        .data.data.status,
      'ACTIVATED'
    );

    const rejected = await request(
      '/nutritionist-applications',
      'POST',
      await applicationPayload(rejectedEmail, `REJECT-${stamp}`)
    );
    assert.equal(rejected.status, 201, JSON.stringify(rejected.data));
    const rejectedApplication = await prisma.nutritionistApplication.findUniqueOrThrow({
      where: { referenceCode: rejected.data.data.referenceCode },
    });
    const rejection = await request(
      `/admin/nutritionist-applications/${rejectedApplication.id}/decision`,
      'PATCH',
      { decision: 'reject', reason: 'Synthetic credential mismatch' },
      adminToken
    );
    assert.equal(rejection.status, 200, JSON.stringify(rejection.data));
    assert.equal(
      (
        await request('/nutritionist-applications/status', 'POST', {
          referenceCode: rejectedApplication.referenceCode,
          email: rejectedEmail,
        })
      ).data.data.status,
      'REJECTED'
    );
    assert.equal(await prisma.user.count({ where: { email: rejectedEmail } }), 0);
    await waitForMail('NUTRITIONIST_APPLICATION_REJECTED', rejectedEmail);

    assert.deepEqual(await applications.checkLicenseAvailability(`REJECT-${stamp}`), { available: true });
    const retryPayload = await applicationPayload(rejectedEmail.toUpperCase(), `reject-${stamp}`);
    const concurrent = await Promise.allSettled([applications.submit(retryPayload), applications.submit(retryPayload)]);
    assert.equal(
      concurrent.filter((result) => result.status === 'fulfilled').length,
      1,
      'Concurrent retries reserve identity once.'
    );
    const second = await prisma.nutritionistApplication.findFirstOrThrow({
      where: { email: rejectedEmail, status: 'SUBMITTED' },
    });
    assert.notEqual(second.referenceCode, rejectedApplication.referenceCode);
    await applications.decide(admin.id, second.id, { decision: 'reject', reason: 'Synthetic second rejection' });
    retryPayload.emailVerificationProof = await verifyInbox(rejectedEmail);
    const third = await applications.submit(retryPayload);
    const thirdRecord = await prisma.nutritionistApplication.findUniqueOrThrow({
      where: { referenceCode: third.referenceCode },
    });
    await applications.decide(admin.id, thirdRecord.id, { decision: 'reject', reason: 'Synthetic third rejection' });
    await assert.rejects(applications.submit(retryPayload), /3 applications per email in 30 days/);
    assert.equal(await prisma.nutritionistApplication.count({ where: { email: rejectedEmail } }), 3);
    assert.equal(
      (await applications.getPublicStatus(rejectedApplication.referenceCode, rejectedEmail)).status,
      'REJECTED',
      'Old reference/reason survives reapplication.'
    );
    await prisma.nutritionistApplication.update({
      where: { id: rejectedApplication.id },
      data: { createdAt: new Date(Date.now() - 31 * 86400000) },
    });
    retryPayload.emailVerificationProof = await verifyInbox(rejectedEmail);
    const outsideWindow = await applications.submit(retryPayload);
    assert.equal(outsideWindow.status, 'SUBMITTED', 'Limit is rolling, not a lifetime block.');
    // Even direct writers cannot create a second active identity after the migration.
    await assert.rejects(
      prisma.nutritionistApplication.create({
        data: {
          ...second,
          availableCallSlots: retryPayload.availableCallSlots,
          id: `duplicate-${stamp}`,
          referenceCode: `NM-DUP-${stamp}`,
          status: 'SUBMITTED',
        },
      }),
      /Unique constraint/
    );

    const raceEmail = `approval-race-${stamp}@example.test`;
    const raceSubmitted = await request(
      '/nutritionist-applications',
      'POST',
      await applicationPayload(raceEmail, `RACE-${stamp}`)
    );
    assert.equal(raceSubmitted.status, 201);
    const raceApplication = await prisma.nutritionistApplication.findUniqueOrThrow({
      where: { referenceCode: raceSubmitted.data.data.referenceCode },
    });
    const raceRoute = `/admin/nutritionist-applications/${raceApplication.id}`;
    assert.equal((await request(`${raceRoute}/stage`, 'PATCH', { status: 'UNDER_REVIEW' }, adminToken)).status, 200);
    assert.equal((await request(`${raceRoute}/stage`, 'PATCH', { status: 'CALL_REQUIRED' }, adminToken)).status, 200);
    assert.equal(
      (
        await request(
          `${raceRoute}/schedule`,
          'PATCH',
          {
            scheduledCallAt: new Date(Date.now() + 1100).toISOString(),
            meetingUrl: 'https://meet.example.test/approval-race',
          },
          adminToken
        )
      ).status,
      200
    );
    await new Promise((resolve) => setTimeout(resolve, 1300));
    assert.equal(
      (await request(`${raceRoute}/call-verification`, 'PATCH', { identityMatched: true }, adminToken)).status,
      200
    );
    const approvals = await Promise.all([
      request(`${raceRoute}/decision`, 'PATCH', { decision: 'approve' }, adminToken),
      request(`${raceRoute}/decision`, 'PATCH', { decision: 'approve' }, adminToken),
    ]);
    assert.deepEqual(
      approvals.map((result) => result.status).sort(),
      [200, 400],
      'Only one simultaneous approval may win.'
    );
    assert.equal(await prisma.user.count({ where: { email: raceEmail } }), 1);
    console.log(
      'PASS: isolated submission, tracking, admin stages, call gate, approval, invitation resend, pre-activation guard, simultaneous approval/activation, replay denial, role access, and rejection.'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

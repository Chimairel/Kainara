/** Real loopback HTTP/SQL mobile session acceptance. No hosted targets or providers. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55433');
  assert.equal(target.pathname, '/kainara_mobile_local');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.MOBILE_AUTH_ENABLED, 'true');
  assert.equal(process.env.GEMINI_API_KEY, '');
  const capture = process.env.NUTRIMIND_TEST_MAIL_CAPTURE_PATH!;
  assert(path.isAbsolute(capture));
  const { default: app } = await import('../src/app');
  const { default: db } = await import('../src/lib/prisma');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const email = `mobile-${randomUUID()}@example.test`;
  const password = `Native9${randomBytes(18).toString('base64url')}`;
  let access = '';
  let checks = 0;
  const call = (endpoint: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) =>
    new Promise<{ status: number; value: any; headers: import('node:http').IncomingHttpHeaders }>((resolve, reject) => {
      const req = httpRequest(origin + '/api' + endpoint, {
        method, headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}), ...headers },
      }, (res) => {
        let text = '';
        res.on('data', (chunk) => { text += chunk; });
        res.on('end', () => {
          try { resolve({ status: res.statusCode!, value: JSON.parse(text), headers: res.headers }); }
          catch (error) { reject(error); }
        });
      });
      req.on('error', reject);
      req.setTimeout(60_000, () => req.destroy(new Error('Local acceptance request timed out.')));
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
  const ok = async (endpoint: string, method = 'GET', body?: unknown) => {
    const response = await call(endpoint, method, body);
    assert(response.status < 300 && response.value.success, `${endpoint}: ${response.status} ${response.value.error ?? ''}`);
    checks++;
    return response.value;
  };
  let userId: string | undefined;
  try {
    const registered = await call('/auth/mobile/register', 'POST', { name: 'Native Acceptance', email, password });
    assert.equal(registered.status, 201);
    assert.equal(registered.headers['set-cookie'], undefined);
    const session = registered.value.data;
    assert(session.accessToken && session.refreshToken);
    assert.equal(session.user.emailVerified, false);
    assert.equal(session.user.passwordHash, undefined);
    userId = session.user.id;
    access = session.accessToken;
    checks++;
    const saved = await db.session.findFirstOrThrow({ where: { userId } });
    assert(!JSON.stringify(saved).includes(session.refreshToken), 'Refresh token must be hashed at rest.');
    const captured = readFileSync(capture, 'utf8').trim().split('\n').map((row) => JSON.parse(row));
    const mail = captured.findLast((row) => row.to === email && row.type === 'EMAIL_VERIFICATION');
    assert(mail?.token);
    await ok('/auth/verify-email', 'POST', { otp: mail.token });
    await ok('/user/onboarding/profile', 'POST', {
      age: 26, biologicalSex: 'MALE', heightCm: 170, weightKg: 65, targetWeightKg: 65,
      goal: 'MAINTAIN', activityLevel: 'SEDENTARY', dietaryPreference: 'OMNIVORE', ricePreference: 'WITH_RICE', foodCulture: 'Filipino',
    });
    for (const domain of ['CONDITION', 'ALLERGY']) await ok('/user/onboarding/safety', 'POST', {
      entries: [{ domain, value: 'NONE', provenance: 'PREDEFINED' }], editableDomains: [domain], confirmed: true,
    });
    await ok('/user/meal-reminders', 'PUT', {
      breakfastTime: '08:00', lunchTime: '13:00', dinnerTime: '19:00', timeZone: 'Asia/Manila',
      remindersEnabled: false, prepareEnabled: false, logEnabled: false,
    });
    await ok('/user/onboarding/shopping-day', 'POST', { shoppingDayOfWeek: 6 });
    const before = (await ok('/user/profile')).data;
    await ok('/user/onboarding/tos', 'POST', {
      termsVersion: before.onboardingStatus.currentTermsVersion, privacyVersion: before.onboardingStatus.currentPrivacyVersion,
      medicalDisclaimerAccepted: true, privacyPolicyAccepted: true, healthDataProcessingAccepted: true,
    });
    await ok('/user/onboarding/complete', 'POST', {});
    const pending = (await ok('/user/profile')).data;
    assert.equal(pending.onboardingDone, true);
    assert.equal(pending.reportAcknowledged, false);
    await ok('/user/nutrition-report/generate', 'POST', {});
    const report = (await ok('/user/nutrition-report')).data;
    assert(report.version && !report.isStale);
    await ok('/user/nutrition-report/acknowledge', 'POST', { version: report.version });
    const ready = (await ok('/user/profile')).data;
    assert.equal(ready.reportAcknowledged, true);
    for (const endpoint of ['/user/meals/current', '/user/meals/history', '/user/grocery/workspace', '/user/progress/history', '/user/water/today', '/user/assistant', '/user/notifications']) {
      await ok(endpoint);
    }
    await ok('/user/water', 'POST', { amountMl: 250 });
    const water = (await ok('/user/water/today')).data;
    assert.equal(water.totalMl, 250);
    await ok('/user/profile', 'PUT', { weightKg: 66 });
    const changed = (await ok('/user/profile')).data;
    assert.equal(changed.reportAcknowledged, false, 'A profile correction restores the report hold.');
    const refreshed = await ok('/auth/mobile/refresh', 'POST', { refreshToken: session.refreshToken });
    assert.notEqual(refreshed.data.refreshToken, session.refreshToken);
    access = refreshed.data.accessToken;
    const replay = await call('/auth/mobile/refresh', 'POST', { refreshToken: session.refreshToken });
    assert.equal(replay.status, 401);
    checks++;
    const blocked = await call('/auth/mobile/login', 'POST', { email, password }, { Origin: 'http://localhost:3000' });
    assert.equal(blocked.status, 403);
    checks++;
    await ok('/auth/mobile/logout', 'POST', { refreshToken: refreshed.data.refreshToken });
    const revoked = await call('/auth/mobile/refresh', 'POST', { refreshToken: refreshed.data.refreshToken });
    assert.equal(revoked.status, 401);
    checks++;
    const fresh = await call('/auth/mobile/login', 'POST', { email, password });
    assert.equal(fresh.status, 200);
    assert.equal(fresh.headers['set-cookie'], undefined);
    const browser = await call('/auth/login', 'POST', { email, password });
    assert.equal(browser.status, 200);
    assert(browser.headers['set-cookie']?.some((cookie) => cookie.includes('HttpOnly')));
    assert.equal(browser.value.data.refreshToken, undefined);
    checks += 2;
    writeFileSync(path.join(path.dirname(capture), 'local-acceptance.json'), JSON.stringify({
      at: new Date().toISOString(), checks, result: 'PASS', loopbackOnly: true, actualSql: true,
      otpCaptureOnly: true, providers: 0, profileGate: 'unacknowledged report preserved',
    }, null, 2));
    console.log(`PASS: ${checks} real loopback HTTP/SQL checks; register, OTP, onboarding, report hold, member reads, water, profile correction, native rotation/revocation and browser-cookie compatibility.`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    const { MealAiQueueService } = await import('../src/services/meal-ai-queue.service');
    await MealAiQueueService.shutdown();
    const { UpcomingPlanPreparationService } = await import('../src/services/upcoming-plan-preparation.service');
    // Drain this fixture's already-admitted background work before deleting it.
    const preparing = (UpcomingPlanPreparationService as unknown as { inFlight: Map<string, Promise<unknown>> }).inFlight;
    while (userId && preparing.has(userId)) await preparing.get(userId);
    if (userId) await db.user.delete({ where: { id: userId } });
    await db.$disconnect();
  }
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Mobile local acceptance failed.'); process.exitCode = 1; });

/** Provider-free report/food feedback acceptance, restricted to one disposable local database. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55432');
  assert.equal(target.pathname, '/kainara_report_feedback_acceptance');
  assert.equal(process.env.NODE_ENV, 'test');
  assert.equal(process.env.CLINICAL_CLARIFICATIONS_ENABLED, 'true');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] ?? '', '');
  const { default: db } = await import('../src/lib/prisma');
  const { default: app } = await import('../src/app');
  const { signAccessToken } = await import('../src/lib/jwt');
  const { NutritionReportService: Reports } = await import('../src/services/nutrition-report.service');
  const { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } = await import('../src/domain/onboarding.policy');
  const { resolveSafetyEntries } = await import('../src/domain/safety-intake.policy');
  assert.equal(await db.user.count(), 0, 'Use a fresh disposable database.');
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (input, init) => {
    assert.equal(new URL(String(input)).hostname, '127.0.0.1');
    return originalFetch(input, init);
  };
  try {
    const user = await db.user.create({
      data: {
        email: `report-${randomUUID()}@example.invalid`,
        name: 'Synthetic report feedback',
        passwordHash: 'NOT_A_LOGIN',
        role: 'USER',
        emailVerified: true,
        onboardingDone: true,
        tosAccepted: true,
        acceptedTermsVersion: CURRENT_TERMS_VERSION,
        acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
        healthDataConsentedAt: new Date(),
        userProfile: {
          create: {
            age: 30,
            biologicalSex: 'MALE',
            heightCm: 170,
            weightKg: 65,
            dailyCalorieTarget: 2155,
            goal: 'MAINTAIN',
            activityLevel: 'LIGHTLY_ACTIVE',
            dietaryPreference: 'OMNIVORE',
            ricePreference: 'NO_RICE',
            shoppingDayOfWeek: 0,
          },
        },
        healthConditions: { create: { condition: 'NONE' } },
        allergies: { create: { allergen: 'NONE' } },
        safetyProfileEntries: {
          create: resolveSafetyEntries([
            { domain: 'CONDITION', value: 'NONE', provenance: 'PREDEFINED' },
            { domain: 'ALLERGY', value: 'NONE', provenance: 'PREDEFINED' },
          ]),
        },
      },
    });
    const headers = {
      Authorization: `Bearer ${signAccessToken({ userId: user.id, email: user.email, role: user.role })}`,
      'Content-Type': 'application/json',
    };
    const call = async (path: string, body?: unknown) => {
      const response = await fetch(base + path, {
        headers,
        method: body ? 'POST' : 'GET',
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json()) as any;
      assert.equal(response.status, 200, `${path}: ${payload.code ?? payload.error ?? ''}`);
      return payload.data;
    };
    const report = await Reports.generateReport(user.id);
    assert.equal(report.calorieCalculation?.rawBmr, 1567.5);
    const live = await call('/user/nutrition-report');
    assert.equal(live.calorieCalculation.dailyCalorieTarget, 2155);
    assert.equal((await Reports.getHistory(user.id))[0].content.calorieCalculation?.inputs.weightKg, 65);
    await db.userProfile.update({ where: { userId: user.id }, data: { weightKg: 75 } });
    const archived = await Reports.getVersionReport(user.id, report.version);
    assert.equal(archived?.calorieCalculation?.inputs.weightKg, 65);
    assert.equal(archived?.calorieCalculation?.dailyCalorieTarget, 2155);
    await db.userProfile.update({ where: { userId: user.id }, data: { weightKg: 65 } });
    await Reports.acknowledgeReport(user.id, report.version);
    const pdf = await fetch(base + '/user/nutrition-report/pdf', { headers });
    assert.equal(pdf.status, 200);
    assert.match(pdf.headers.get('content-type') ?? '', /application\/pdf/);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    assert(bytes.length > 1000);
    assert.equal(bytes.subarray(0, 4).toString(), '%PDF');
    const key = randomUUID();
    const preview = await call('/user/meals/log-outside', {
      requestKey: key,
      mealType: 'LUNCH',
      useAiEstimate: false,
      items: [
        {
          name: 'Synthetic logged food',
          portionGrams: 100,
          reportedNutrition: { calories: 200, proteinG: 10, carbsG: 25, fatG: 7 },
        },
      ],
    });
    assert(preview.warningRequired);
    const saved = await call('/user/meals/log-outside', {
      requestKey: key,
      mealType: 'LUNCH',
      warningAcknowledged: true,
      confirmationId: preview.confirmationId,
    });
    assert(saved.log.id);
    assert(saved.log.outsideItems[0].id);
    assert.equal(
      await db.outsideMealReview.count({
        where: { outsideMealLogItem: { mealLogId: saved.log.id }, requestedByUserAt: { not: null } },
      }),
      0
    );
    await call(`/user/meals/logs/${saved.log.id}/items/${saved.log.outsideItems[0].id}/request-review`, {});
    const history = await call('/user/meals/history');
    const entry = history.find((log: any) => log.id === saved.log.id);
    assert.equal(entry.outsideItems[0].review.status, 'PENDING');
    assert(entry.outsideItems[0].review.requestedByUserAt);
    assert.equal(await db.mealLog.count({ where: { userId: user.id } }), 1);
    assert.equal(await db.aiUsageEvent.count(), 0);
    console.log(
      JSON.stringify({
        checks: [
          'saved report calorie calculation',
          'archive inputs independent of live profile',
          'real PDF export',
          'food saved before separate feedback admission',
          'history pending feedback without duplicate food',
        ],
        geminiCalls: 0,
        target: 'disposable loopback only',
      })
    );
  } finally {
    globalThis.fetch = originalFetch;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

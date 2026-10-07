/** Fresh local PostgreSQL only. Synthetic users, meal evidence and push transport. */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import app from '../src/app';
import prisma from '../src/lib/prisma';
import { signAccessToken } from '../src/lib/jwt';
import { MealReminderService } from '../src/services/meal-reminder.service';
import { WebPushService } from '../src/services/web-push.service';
import { UserProfileService } from '../src/services/user-profile.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../src/domain/onboarding.policy';
import { getManilaDateKey, getManilaMidnight } from '../src/domain/meal-plan-cycle.policy';
import { MEAL_PLAN_SAFETY_POLICY_VERSION } from '../src/domain/meal-plan-production-safety.policy';
import webpush from 'web-push';

async function main() {
  const target = new URL(process.env.DATABASE_URL || '');
  assert.equal(target.hostname, '127.0.0.1');
  assert.equal(target.port, '55480');
  assert.equal(target.pathname, '/kainara_meal_reminders');
  assert.equal(process.env.NODE_ENV, 'test');
  for (const key of ['GEMINI_API_KEY', 'SMTP_USER', 'BREVO_API_KEY', 'PAYMONGO_SECRET_KEY'])
    assert.equal(process.env[key] || '', '');
  const run = randomUUID();
  const now = new Date();
  const today = getManilaDateKey(now);
  const member = await prisma.user.create({
    data: {
      name: 'Synthetic reminder member',
      email: `${run}@example.invalid`,
      passwordHash: 'not-a-login-fixture',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      acceptedTermsVersion: CURRENT_TERMS_VERSION,
      acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      safetyProfileEntries: {
        create: (['CONDITION', 'ALLERGY'] as const).map((domain) => ({
          domain,
          canonicalCode: 'NONE',
          displayName: 'None declared',
          originalText: 'None declared',
          normalizedText: 'none declared',
          provenance: 'PREDEFINED',
          supportState: 'SUPPORTED',
          policyReference: 'SYNTHETIC_ENGINEERING_FIXTURE',
        })),
      },
      userProfile: { create: { revision: 1 } },
      nutritionReport: {
        create: {
          profileRevision: 1,
          acknowledgedAt: now,
          foodsToAvoid: [],
          foodsToLimit: [],
          foodsRecommended: [],
          drinksGuidance: [],
          basedOnConditions: [],
          basedOnAllergies: [],
          generalSummary: 'Synthetic engineering fixture',
        },
      },
    },
  });
  const other = await prisma.user.create({
    data: {
      name: 'Other synthetic member',
      email: `${run}-other@example.invalid`,
      passwordHash: 'not-a-login-fixture',
      emailVerified: true,
    },
  });
  const admin = await prisma.user.create({
    data: {
      name: 'Synthetic admin',
      email: `${run}-admin@example.invalid`,
      passwordHash: 'not-a-login-fixture',
      emailVerified: true,
      role: 'ADMIN',
    },
  });
  const day = getManilaMidnight(today);
  const cycle = await prisma.mealPlanCycle.create({
    data: {
      id: run,
      userId: member.id,
      planType: 'WEEKLY',
      startDate: day,
      endDate: new Date(day.getTime() + 6 * 86_400_000),
      preparationOpensAt: day,
      shoppingDeadlineAt: day,
      expectedSlotCount: 21,
      status: 'ACTIVE',
    },
  });
  const raw = await prisma.rawRecipeCandidate.create({
    data: {
      sourceRecordId: run,
      sourceUrl: 'https://example.invalid/synthetic-recipe',
      recipeName: 'Synthetic meal',
      normalizedName: 'synthetic meal',
      contentSignature: run,
      cuisines: [],
      dietaryTags: [],
      ingredients: [],
      publishedNutrition: { fixture: true },
      mealType: 'BREAKFAST',
    },
  });
  const meal = await prisma.mealPlan.create({
    data: {
      userId: member.id,
      planGroupId: cycle.id,
      scheduledDate: day,
      mealType: 'BREAKFAST',
      mealName: 'Synthetic meal',
      calories: 400,
      proteinG: 20,
      carbsG: 50,
      fatG: 12,
      status: 'APPROVED',
      requiresSafetyRevalidation: false,
      safetyPolicyVersion: MEAL_PLAN_SAFETY_POLICY_VERSION,
      baseRecipeSignature: run,
      composedServingSignature: run,
      candidateProvenance: 'RAW_RECIPE_CORPUS',
      sourceRawRecipeCandidateId: raw.id,
    },
  });
  const keys = webpush.generateVAPIDKeys();
  const receiver = webpush.generateVAPIDKeys();
  process.env.WEB_PUSH_ENABLED = 'true';
  process.env.WEB_PUSH_PUBLIC_KEY = keys.publicKey;
  process.env.WEB_PUSH_PRIVATE_KEY = keys.privateKey;
  process.env.WEB_PUSH_SUBJECT = 'https://example.invalid';
  const input = {
    endpoint: `https://fcm.googleapis.com/send/${run}`,
    keys: { p256dh: receiver.publicKey, auth: Buffer.alloc(16, 2).toString('base64url') },
  };
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token = (user: typeof member) => signAccessToken({ userId: user.id, email: user.email, role: user.role });
  const request = async (path: string, method: string, body?: unknown, owner = member) => {
    const response = await fetch(base + path, {
      method,
      headers: { Authorization: `Bearer ${token(owner)}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(15_000),
    });
    return { status: response.status, body: (await response.json()) as { success: boolean; data?: unknown } };
  };
  let sends = 0;
  const originalSend = webpush.sendNotification;
  webpush.sendNotification = (async (subscription, payload, options) => {
    // Exercise the actual encryption/VAPID request builder; no provider connection.
    const details = webpush.generateRequestDetails(subscription, payload ?? undefined, options);
    assert.ok(Buffer.isBuffer(details.body));
    assert.ok(details.headers.Authorization);
    sends++;
    return { statusCode: 201, headers: {}, body: '' };
  }) as typeof originalSend;
  try {
    assert.equal((await request('/api/user/meal-reminders', 'PUT', { breakfastTime: '25:00' })).status, 400);
    const eating = new Date(now.getTime() + 60 * 60_000);
    const localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(eating);
    const settings = {
      breakfastTime: localTime,
      lunchTime: '12:00',
      dinnerTime: '18:00',
      timeZone: 'Asia/Manila',
      remindersEnabled: true,
      prepareEnabled: true,
      logEnabled: false,
    };
    assert.equal((await request('/api/user/meal-reminders', 'PUT', settings)).status, 200);
    assert.equal(
      (await request('/api/user/meal-reminders', 'PUT', { ...settings, prepareMinutesBefore: 15 })).status,
      200
    );
    await request('/api/user/meal-reminders', 'PUT', settings);
    assert.equal(
      (await prisma.mealReminderSettings.findUniqueOrThrow({ where: { userId: member.id } })).prepareMinutesBefore,
      15,
      'Old clients must preserve an existing custom lead.'
    );
    await request('/api/user/meal-reminders', 'PUT', { ...settings, prepareMinutesBefore: 60 });
    assert.equal((await request('/api/user/meal-reminders', 'PUT', settings, admin)).status, 403);
    assert.equal((await prisma.userProfile.findUniqueOrThrow({ where: { userId: member.id } })).revision, 1);
    const profile = await UserProfileService.getAuthenticatedProfileDetails(member.id);
    assert.ok(profile?.profile.nutritionReport?.acknowledgedAt, 'Synthetic legacy report must be acknowledged.');
    assert.deepEqual(
      await MealPlanCycleService.getClearedMealPlanIds(member.id, cycle.id),
      [meal.id],
      'Synthetic raw fixture must pass the real clearance reader.'
    );
    assert.ok(await MealReminderService.eligibleMeal(member.id, today, 'BREAKFAST'));
    assert.equal(
      (await request('/api/notifications/push/subscription', 'POST', { ...input, endpoint: 'https://127.0.0.1/' }))
        .status,
      400
    );
    assert.equal((await request('/api/notifications/push/subscription', 'POST', input)).status, 200);
    const subscription = await prisma.webPushSubscription.findUniqueOrThrow({ where: { endpoint: input.endpoint } });
    assert.deepEqual(
      (await request('/api/notifications/push/status', 'POST', { endpoint: input.endpoint }, other)).body.data,
      { subscribed: false, delivery: null }
    );
    await request('/api/notifications/push/subscription', 'DELETE', { endpoint: input.endpoint }, other);
    assert.equal(await prisma.webPushSubscription.count(), 1);
    await Promise.all([MealReminderService.createDueReminders(now), MealReminderService.createDueReminders(now)]);
    const notifications = await prisma.notification.findMany({ where: { userId: member.id, type: 'MEAL_REMINDER' } });
    assert.equal(notifications.length, 1, 'Concurrent schedules must create one reminder inbox record.');
    const reminder = notifications[0];
    await Promise.all([
      WebPushService.deliver(subscription.id, reminder.id, () => MealReminderService.stillEligible(reminder)),
      WebPushService.deliver(subscription.id, reminder.id, () => MealReminderService.stillEligible(reminder)),
    ]);
    assert.equal(sends, 1);
    assert.equal(await prisma.webPushDelivery.count({ where: { status: 'SENT' } }), 1);
    await prisma.mealPlan.update({ where: { id: meal.id }, data: { status: 'PENDING_REVIEW' } });
    assert.equal(await MealReminderService.eligibleMeal(member.id, today, 'BREAKFAST'), null);
    await prisma.mealPlan.update({
      where: { id: meal.id },
      data: { status: 'APPROVED', requiresSafetyRevalidation: true },
    });
    assert.equal(await MealReminderService.eligibleMeal(member.id, today, 'BREAKFAST'), null);
    await prisma.mealPlan.update({ where: { id: meal.id }, data: { requiresSafetyRevalidation: false } });
    await prisma.mealLog.create({
      data: {
        userId: member.id,
        mealPlanId: meal.id,
        source: 'SYSTEM_GENERATED',
        mealName: meal.mealName,
        calories: 400,
        proteinG: 20,
        carbsG: 50,
        fatG: 12,
        dataSource: 'FNRI',
        status: 'SKIPPED',
      },
    });
    assert.equal(await MealReminderService.eligibleMeal(member.id, today, 'BREAKFAST'), null);
    await prisma.mealLog.deleteMany({ where: { userId: member.id } });
    await prisma.nutritionReport.update({ where: { userId: member.id }, data: { acknowledgedAt: null } });
    assert.equal(await MealReminderService.eligibleMeal(member.id, today, 'BREAKFAST'), null);
    await WebPushService.subscribe(other.id, input);
    assert.equal(
      (await prisma.webPushSubscription.findUniqueOrThrow({ where: { endpoint: input.endpoint } })).userId,
      other.id
    );
    assert.equal(await prisma.webPushDelivery.count(), 0, 'Rebinding must remove previous account receipts.');
    await prisma.user.delete({ where: { id: other.id } });
    assert.equal(await prisma.webPushSubscription.count(), 0);
    console.log(
      'PASS HTTP validation/RBAC/ownership, additive schema, profile revision preservation, real clearance, concurrent reminder/delivery deduplication, VAPID encryption, pending/revalidation/report/log suppression, account rebind/deletion cascade.'
    );
  } finally {
    webpush.sendNotification = originalSend;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  }
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Synthetic local acceptance failed.');
  process.exitCode = 1;
});

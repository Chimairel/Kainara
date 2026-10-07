import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import {
  dueMealReminders,
  mealTimeInstant,
  isAllowedPushEndpoint,
  type MealSchedule,
} from '../src/domain/meal-reminder.policy';
import { mealReminderSettingsSchema, pushSubscriptionSchema } from '../src/validation/meal-reminder.schemas';
import {
  evaluateOnboardingStatus,
  CURRENT_TERMS_VERSION,
  CURRENT_PRIVACY_VERSION,
} from '../src/domain/onboarding.policy';
import prisma from '../src/lib/prisma';
import { MealReminderService } from '../src/services/meal-reminder.service';
import { UserProfileService } from '../src/services/user-profile.service';
import { MealPlanCycleService } from '../src/services/meal-plan-cycle.service';
import { WebPushService } from '../src/services/web-push.service';
import webpush from 'web-push';

const schedule: MealSchedule = {
  breakfastTime: '07:00',
  lunchTime: '12:00',
  dinnerTime: '18:00',
  timeZone: 'Asia/Manila',
  remindersEnabled: true,
  prepareEnabled: true,
  logEnabled: true,
};
function stub<T extends object, K extends keyof T>(context: TestContext, target: T, name: K, value: unknown) {
  const original = target[name];
  target[name] = value as T[K];
  context.after(() => {
    target[name] = original;
  });
}

test('reminders follow the saved timezone, 60-minute preparation offset and expiry window', () => {
  const due = dueMealReminders(schedule, new Date('2026-10-06T22:00:00Z'));
  assert.equal(due.length, 1);
  assert.equal(due[0].kind, 'PREPARE');
  assert.equal(due[0].day, '2026-10-07');
  assert.equal(due[0].mealType, 'BREAKFAST');
  assert.equal(dueMealReminders(schedule, new Date('2026-10-06T21:59:59Z')).length, 0);
  assert.equal(dueMealReminders(schedule, new Date('2026-10-06T22:10:00Z')).length, 0);
  assert.equal(dueMealReminders(schedule, new Date('2026-10-07T00:00:00Z'))[0].kind, 'LOG');
  assert.equal(dueMealReminders({ ...schedule, remindersEnabled: false }, new Date('2026-10-06T22:00:00Z')).length, 0);
  assert.equal(dueMealReminders({ ...schedule, prepareEnabled: false }, new Date('2026-10-06T22:00:00Z')).length, 0);
});
test('preparation and logging across local midnight retain the meal date', () => {
  assert.equal(
    dueMealReminders({ ...schedule, breakfastTime: '00:30' }, new Date('2026-10-06T15:30:00Z'))[0].day,
    '2026-10-07'
  );
  const due = dueMealReminders({ ...schedule, dinnerTime: '23:30' }, new Date('2026-10-06T16:30:00Z'));
  assert.equal(due[0].day, '2026-10-06');
  assert.equal(due[0].kind, 'LOG');
});
test('DST uses current zone rules and skips nonexistent wall times', () => {
  assert.equal(mealTimeInstant('2026-03-08', '02:30', 'America/New_York'), null);
  assert.equal(mealTimeInstant('2026-03-08', '07:00', 'America/New_York')?.toISOString(), '2026-03-08T11:00:00.000Z');
  assert.equal(mealTimeInstant('2026-01-08', '07:00', 'America/New_York')?.toISOString(), '2026-01-08T12:00:00.000Z');
  const fall = { ...schedule, timeZone: 'America/New_York', breakfastTime: '01:30' };
  assert.equal(dueMealReminders(fall, new Date('2026-11-01T06:30:00Z')).filter((d) => d.kind === 'LOG').length, 1);
  assert.equal(dueMealReminders(fall, new Date('2026-11-01T07:30:00Z')).filter((d) => d.kind === 'LOG').length, 0);
});
test('meal schedule rejects malformed times, unknown zones and unsupported fields', () => {
  assert.equal(mealReminderSettingsSchema.safeParse(schedule).success, true);
  for (const value of ['24:00', '7:00', '12:60', ''])
    assert.equal(mealReminderSettingsSchema.safeParse({ ...schedule, breakfastTime: value }).success, false);
  assert.equal(mealReminderSettingsSchema.safeParse({ ...schedule, timeZone: 'Unknown/Place' }).success, false);
  assert.equal(mealReminderSettingsSchema.safeParse({ ...schedule, userId: 'other' }).success, false);
  for (const minutes of [-1, 181, 1.5, '15'])
    assert.equal(mealReminderSettingsSchema.safeParse({ ...schedule, prepareMinutesBefore: minutes }).success, false);
});
test('custom preparation lead supports meal-time delivery and crosses midnight without changing the meal day', () => {
  const immediate = dueMealReminders({ ...schedule, prepareMinutesBefore: 0 }, new Date('2026-10-06T23:00:00Z'));
  assert.equal(immediate[0].kind, 'PREPARE');
  const early = dueMealReminders({ ...schedule, prepareMinutesBefore: 15 }, new Date('2026-10-06T22:45:00Z'));
  assert.equal(early[0].kind, 'PREPARE');
  assert.equal(
    dueMealReminders(
      { ...schedule, breakfastTime: '01:00', prepareMinutesBefore: 180 },
      new Date('2026-10-06T14:00:00Z')
    )[0].day,
    '2026-10-07'
  );
  assert.equal(dueMealReminders({ ...schedule, prepareMinutesBefore: -1 }, new Date('2026-10-06T22:00:00Z')).length, 0);
});
test('push validation cannot target arbitrary servers or malformed encryption material', () => {
  for (const endpoint of [
    'https://127.0.0.1/send',
    'http://fcm.googleapis.com/send',
    'https://fcm.googleapis.com.evil.invalid/send',
    'https://user:pass@web.push.apple.com/send',
    'https://fcm.googleapis.com:444/send',
  ])
    assert.equal(isAllowedPushEndpoint(endpoint), false);
  for (const endpoint of [
    'https://fcm.googleapis.com/send/a',
    'https://updates.push.services.mozilla.com/wpush/v2/a',
    'https://web.push.apple.com/a',
    'https://wns2.notify.windows.com/a',
  ])
    assert.equal(isAllowedPushEndpoint(endpoint), true);
  assert.equal(
    pushSubscriptionSchema.safeParse({
      endpoint: 'https://fcm.googleapis.com/send/a',
      keys: { auth: 'bad', p256dh: 'bad' },
    }).success,
    false
  );
});
test('new onboarding requires saved meal times while completed members keep access', () => {
  const base = {
    onboardingDone: false,
    tosAccepted: true,
    acceptedTermsVersion: CURRENT_TERMS_VERSION,
    acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
    profile: {
      age: 25,
      biologicalSex: 'MALE',
      heightCm: 170,
      weightKg: 65,
      targetWeightKg: 65,
      goal: 'MAINTAIN',
      activityLevel: 'ACTIVE',
      dietaryPreference: 'OMNIVORE',
      ricePreference: 'FLEXIBLE',
      foodCulture: 'Filipino',
      shoppingDayOfWeek: 6,
    },
    conditions: [],
    allergies: [],
    safetyEntries: [{ domain: 'CONDITION' }, { domain: 'ALLERGY' }],
    mealSchedule: null,
  };
  assert.equal(evaluateOnboardingStatus(base).nextPath, '/onboarding/preferences');
  assert.equal(evaluateOnboardingStatus(base).readyToComplete, false);
  assert.equal(evaluateOnboardingStatus({ ...base, mealSchedule: schedule }).readyToComplete, true);
  assert.equal(evaluateOnboardingStatus({ ...base, onboardingDone: true }).readyToComplete, true);
});
test('meal reminder eligibility reuses fresh clearance and excludes blocked accounts and logged meals', async (context) => {
  let allowed = true;
  let logged = false;
  let reported = true;
  let suspended = false;
  context.mock.method(UserProfileService, 'getAuthenticatedProfileDetails', async () => ({
    role: 'USER',
    isSuspended: suspended,
    profile: {
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      acceptedTermsVersion: CURRENT_TERMS_VERSION,
      acceptedPrivacyVersion: CURRENT_PRIVACY_VERSION,
      reportAcknowledged: reported,
    },
  }));
  stub(context, prisma.mealPlanCycle, 'findMany', async () => [{ id: 'cycle' }]);
  context.mock.method(MealPlanCycleService, 'getClearedMealPlanIds', async () => (allowed ? ['slot'] : []));
  stub(context, prisma.mealPlan, 'findMany', async (query: { where: { userId: string; id: { in: string[] } } }) => {
    assert.equal(query.where.userId, 'member');
    return query.where.id.in.length
      ? [
          {
            id: 'slot',
            scheduledDate: new Date('2026-10-07T00:00:00Z'),
            mealLogs: logged ? [{ status: 'SKIPPED' }] : [],
          },
        ]
      : [];
  });
  assert.ok(await MealReminderService.eligibleMeal('member', '2026-10-07', 'BREAKFAST'));
  allowed = false;
  assert.equal(await MealReminderService.eligibleMeal('member', '2026-10-07', 'BREAKFAST'), null);
  allowed = true;
  logged = true;
  assert.equal(await MealReminderService.eligibleMeal('member', '2026-10-07', 'BREAKFAST'), null);
  logged = false;
  reported = false;
  assert.equal(await MealReminderService.eligibleMeal('member', '2026-10-07', 'BREAKFAST'), null);
  reported = true;
  suspended = true;
  assert.equal(await MealReminderService.eligibleMeal('member', '2026-10-07', 'BREAKFAST'), null);
});
test('push receipts claim once, suppress stale/invalid meals, and retire expired subscriptions', async (context) => {
  const oldEnv = { ...process.env };
  const keys = webpush.generateVAPIDKeys();
  process.env.WEB_PUSH_ENABLED = 'true';
  process.env.WEB_PUSH_PUBLIC_KEY = keys.publicKey;
  process.env.WEB_PUSH_PRIVATE_KEY = keys.privateKey;
  process.env.WEB_PUSH_SUBJECT = 'https://example.invalid';
  context.after(() => {
    process.env = oldEnv;
  });
  let status = 'PENDING',
    sends = 0,
    retired = 0,
    reminder = false,
    read = false,
    manualTest = false,
    expired = false;
  const subscription = {
    id: 'device',
    userId: 'member',
    user: { role: 'USER', emailVerified: true, isSuspended: false },
    endpoint: 'https://fcm.googleapis.com/send/synthetic',
    p256dh: keys.publicKey,
    auth: Buffer.alloc(16).toString('base64url'),
  };
  stub(context, prisma.webPushDelivery, 'createMany', async () => ({ count: 1 }));
  stub(
    context,
    prisma.webPushDelivery,
    'updateMany',
    async (query: { where: { status: string }; data: { status: string } }) => {
      if (status !== query.where.status) return { count: 0 };
      status = query.data.status;
      return { count: 1 };
    }
  );
  stub(context, prisma.webPushSubscription, 'findUnique', async () => subscription);
  stub(context, prisma.webPushSubscription, 'deleteMany', async () => {
    retired++;
    return { count: 1 };
  });
  stub(context, prisma.notification, 'findUnique', async () => ({
    id: 'alert',
    userId: 'member',
    isRead: read,
    context: manualTest ? { test: true } : null,
    type: reminder ? 'MEAL_REMINDER' : 'PLAN_APPROVED',
    title: reminder ? 'Time to prepare breakfast' : 'Private detail',
    message: reminder ? 'Open KAINARA to get ready.' : 'Private health detail',
    targetPath: null,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  context.mock.method(
    webpush,
    'sendNotification',
    async (device: webpush.PushSubscription, payload: string, options: webpush.RequestOptions) => {
      sends++;
      assert.ok(!payload.includes('Private'));
      const request = webpush.generateRequestDetails(device, payload, options);
      assert.equal(request.headers.Urgency, reminder ? 'high' : 'normal');
      assert.ok(Number(request.headers.TTL) > 0 && Number(request.headers.TTL) <= 60);
      if (expired) throw { statusCode: 410 };
    }
  );
  assert.equal(await WebPushService.deliver('device', 'alert'), true);
  assert.equal(await WebPushService.deliver('device', 'alert'), false);
  assert.equal(sends, 1);
  status = 'PENDING';
  reminder = true;
  assert.equal(await WebPushService.deliver('device', 'alert'), true);
  assert.equal(sends, 2);
  status = 'PENDING';
  read = true;
  manualTest = true;
  assert.equal(
    await WebPushService.deliver('device', 'alert'),
    true,
    'Reading the inbox must not cancel a requested test'
  );
  assert.equal(sends, 3);
  status = 'PENDING';
  manualTest = false;
  assert.equal(await WebPushService.deliver('device', 'alert'), false, 'Read ordinary alerts remain suppressed');
  read = false;
  status = 'PENDING';
  assert.equal(await WebPushService.deliver('device', 'alert', async () => false), false);
  assert.equal(status, 'CANCELLED');
  assert.equal(sends, 3);
  status = 'PENDING';
  expired = true;
  assert.equal(await WebPushService.deliver('device', 'alert'), false);
  assert.equal(retired, 1);
});

test('device test submits immediately with a five-minute expiry instead of waiting for the scheduled worker', async (context) => {
  const start = Date.now();
  stub(context, prisma.webPushSubscription, 'findFirst', async () => ({ id: 'device' }));
  stub(context, prisma.webPushDelivery, 'findFirst', async () => null);
  stub(
    context,
    prisma.notification,
    'create',
    async (query: { data: { expiresAt: Date; context: { test: boolean } } }) => {
      assert.ok(query.data.expiresAt.getTime() >= start + 299_000);
      assert.ok(query.data.expiresAt.getTime() <= Date.now() + 300_000);
      assert.equal(query.data.context.test, true);
      return { id: 'test-alert' };
    }
  );
  const delivered = context.mock.method(WebPushService, 'deliver', async (device: string, notification: string) => {
    assert.equal(device, 'device');
    assert.equal(notification, 'test-alert');
    return true;
  });
  assert.deepEqual(await WebPushService.test('member', 'https://fcm.googleapis.com/send/synthetic'), {
    accepted: true,
  });
  assert.equal(delivered.mock.callCount(), 1);
});

test('manual test observes an existing send claim without falsely reporting failure or resending', async (context) => {
  stub(context, prisma.webPushSubscription, 'findFirst', async () => ({ id: 'device' }));
  stub(context, prisma.webPushDelivery, 'findFirst', async () => null);
  stub(context, prisma.notification, 'create', async () => ({ id: 'test-alert' }));
  let status = 'SENT';
  stub(
    context,
    prisma.webPushDelivery,
    'findUnique',
    async (query: { where: { subscriptionId_notificationId: { subscriptionId: string; notificationId: string } } }) => {
      assert.deepEqual(query.where.subscriptionId_notificationId, {
        subscriptionId: 'device',
        notificationId: 'test-alert',
      });
      return { status };
    }
  );
  const deliver = context.mock.method(WebPushService, 'deliver', async () => false);
  assert.deepEqual(await WebPushService.test('member', 'https://fcm.googleapis.com/send/synthetic'), {
    accepted: true,
  });
  status = 'SENDING';
  assert.deepEqual(await WebPushService.test('member', 'https://fcm.googleapis.com/send/synthetic'), {
    accepted: false,
    processing: true,
  });
  status = 'FAILED';
  await assert.rejects(WebPushService.test('member', 'https://fcm.googleapis.com/send/synthetic'), {
    statusCode: 503,
    errorCode: 'PUSH_SEND_FAILED',
  });
  assert.equal(deliver.mock.callCount(), 3, 'Each request tries once; no ambiguous send is replayed');
});

test('scheduled worker leaves manual tests to their selected-device request', async (context) => {
  const oldEnv = { ...process.env };
  const keys = webpush.generateVAPIDKeys();
  Object.assign(process.env, {
    WEB_PUSH_ENABLED: 'true',
    WEB_PUSH_PUBLIC_KEY: keys.publicKey,
    WEB_PUSH_PRIVATE_KEY: keys.privateKey,
    WEB_PUSH_SUBJECT: 'https://example.invalid',
  });
  context.after(() => {
    process.env = oldEnv;
  });
  context.mock.method(MealReminderService, 'createDueReminders', async () => 0);
  stub(context, prisma.webPushSubscription, 'findMany', async () => [
    { id: 'other-device', userId: 'member', createdAt: new Date() },
  ]);
  stub(context, prisma.user, 'findUnique', async () => ({ isSuspended: false, emailVerified: true }));
  stub(context, prisma.notification, 'findMany', async () => [
    { id: 'manual', type: 'MEAL_REMINDER', context: { test: true } },
    { id: 'ordinary', type: 'PLAN_APPROVED', context: null },
  ]);
  const delivered = context.mock.method(WebPushService, 'deliver', async (device: string, notification: string) => {
    assert.equal(device, 'other-device');
    assert.equal(notification, 'ordinary');
    return true;
  });
  assert.deepEqual(await MealReminderService.run(), { enabled: true, created: 0, sent: 1 });
  assert.equal(delivered.mock.callCount(), 1);
});

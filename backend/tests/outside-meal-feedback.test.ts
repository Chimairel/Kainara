import assert from 'node:assert/strict';
import test from 'node:test';
import prisma from '../src/lib/prisma';
import { sendOutsideMealFeedback } from '../src/services/outside-meal-feedback.service';
import { isCurrentOutsideReview } from '../src/domain/outside-meal-review.policy';
import { outsideMealReviewBodySchema } from '../src/validation/user-action.schemas';

test('feedback binds the opened revision and rejects attempts to alter nutrition', () => {
  assert.equal(
    outsideMealReviewBodySchema.safeParse({ action: 'FEEDBACK', reason: 'Try a smaller portion.' }).success,
    false
  );
  assert.equal(
    outsideMealReviewBodySchema.safeParse({
      action: 'FEEDBACK',
      expectedRevision: 2,
      reason: 'Try a smaller portion.',
      calories: 50,
    }).success,
    false
  );
  assert.equal(
    outsideMealReviewBodySchema.safeParse({ action: 'FEEDBACK', expectedRevision: 2, reason: 'Try a smaller portion.' })
      .success,
    true
  );
});

test('feedback completes the same nutrition revision; editing food permits a fresh request', () => {
  const item = {
    currentRevision: 2,
    review: { status: 'FEEDBACK_SENT', reviewedRevision: 2, requestedByUserAt: new Date() },
  };
  assert.equal(isCurrentOutsideReview(item), true);
  assert.equal(isCurrentOutsideReview({ ...item, currentRevision: 3 }), false);
  assert.equal(
    isCurrentOutsideReview({ ...item, review: { ...item.review, status: 'VERIFIED', reviewedRevision: 1 } }),
    true
  );
});

test('feedback atomically closes only an available requested log, saves advice, notifies and audits without nutrition writes', async (context) => {
  let complete = false;
  const messages: any[] = [],
    notifications: any[] = [],
    audits: any[] = [];
  const tx = {
    outsideMealReview: {
      findFirst: async (args: any) => {
        assert.equal(args.where.requestedByUserAt.not, null);
        assert.equal(args.where.outsideMealLogItem.currentRevision, 2);
        assert.equal(args.where.outsideMealLogItem.mealLog.status, 'DONE');
        assert.deepEqual(args.where.status.in, ['PENDING', 'CLAIMED']);
        assert.equal(args.where.OR[1].claimedByNutritionistId, 'rnd');
        return complete
          ? null
          : { id: 'review', outsideMealLogItem: { id: 'item', name: 'Test food', mealLog: { userId: 'member' } } };
      },
      updateMany: async (args: any) => {
        assert.equal(args.data.status, 'FEEDBACK_SENT');
        assert.equal(args.data.reviewedRevision, 2);
        assert.equal(args.data.claimedByNutritionistId, null);
        complete = true;
        return { count: 1 };
      },
    },
    nutritionistProfile: { findUniqueOrThrow: async () => ({ userId: 'rnd-user' }) },
    outsideMealReviewMessage: {
      create: async (args: any) => {
        messages.push(args.data);
      },
    },
    notification: {
      create: async (args: any) => {
        notifications.push(args.data);
      },
    },
    auditEvent: {
      create: async (args: any) => {
        audits.push(args.data);
      },
    },
  };
  // Any item revision, daily total, recipe or clearance access fails this test.
  const guarded = new Proxy(tx, {
    get(target, key) {
      assert.ok(key in target, `Unexpected nutrition access: ${String(key)}`);
      return target[key as keyof typeof tx];
    },
  });
  context.mock.method(prisma, '$transaction', async (work: any) => work(guarded));
  await sendOutsideMealFeedback('rnd', 'review', 2, ' Consider a smaller portion. ');
  assert.equal(messages[0].content, 'Consider a smaller portion.');
  assert.equal(messages[0].itemRevision, 2);
  assert.equal(notifications[0].userId, 'member');
  assert.equal(audits[0].action, 'OUTSIDE_MEAL_FEEDBACK_SENT');
  assert.equal(audits[0].metadata.nutritionUnchanged, true);
  await assert.rejects(sendOutsideMealFeedback('rnd', 'review', 2, 'Duplicate advice.'), {
    errorCode: 'FEEDBACK_CONFLICT',
  });
  assert.equal(messages.length, 1);
});

test('a competing update prevents message, notification and audit writes', async (context) => {
  const tx = {
    outsideMealReview: {
      findFirst: async () => ({ id: 'review', outsideMealLogItem: { id: 'item', mealLog: { userId: 'member' } } }),
      updateMany: async () => ({ count: 0 }),
    },
    nutritionistProfile: { findUniqueOrThrow: async () => ({ userId: 'rnd-user' }) },
  };
  context.mock.method(prisma, '$transaction', async (work: any) => work(tx));
  await assert.rejects(sendOutsideMealFeedback('rnd', 'review', 2, 'New feedback.'), {
    errorCode: 'FEEDBACK_CONFLICT',
  });
});

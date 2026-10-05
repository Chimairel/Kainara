import assert from 'node:assert/strict';
import test from 'node:test';
import {
  membershipFeatureCap,
  membershipLimits,
  membershipSwapCap,
  assertMemberPlanPreparation,
  ACTIVE_MEMBERSHIP_FEATURES,
  membershipWeek,
  resolveMembershipLevel,
} from '../src/domain/membership.policy';
import { resolveBillingEntitlement } from '../src/domain/billing-entitlement.policy';

const at = new Date('2026-10-01T04:00:00.000Z');
test('membership clock is one 30-day period including the starter, ending at the exact instant', () => {
  assert.equal(resolveMembershipLevel({ at, trialStartedAt: null, paidUntil: null }).level, 'TRIAL_PENDING');
  const started = new Date(at.getTime() - 29 * 86_400_000);
  const trial = resolveMembershipLevel({ at, trialStartedAt: started, paidUntil: null });
  assert.equal(trial.level, 'TRIAL');
  assert.equal(trial.trialEndsAt?.toISOString(), '2026-10-02T04:00:00.000Z');
  assert.equal(
    resolveMembershipLevel({ at: trial.trialEndsAt!, trialStartedAt: started, paidUntil: null }).level,
    'FREE'
  );
  assert.throws(() => resolveMembershipLevel({ at, trialStartedAt: new Date(at.getTime() + 1), paidUntil: null }));
});

test('all weekly usage resets at Monday midnight in Manila, including year boundaries', () => {
  assert.equal(membershipWeek(new Date('2026-10-04T15:59:59.999Z')).start.toISOString(), '2026-09-27T16:00:00.000Z');
  assert.equal(membershipWeek(new Date('2026-10-04T16:00:00.000Z')).start.toISOString(), '2026-10-04T16:00:00.000Z');
  assert.equal(membershipWeek(new Date('2027-01-01T00:00:00.000Z')).end.toISOString(), '2027-01-03T16:00:00.000Z');
});

test('Free, Lifestyle and Health have tier-specific configurable allowances', () => {
  const limits = membershipLimits({});
  assert.deepEqual(limits, {
    freeSwaps: 3,
    freeEstimates: 2,
    lifestyleSwaps: 10,
    healthSwaps: 21,
    memberEstimates: 10,
    memberPlanReviews: 1,
    memberOutsideReviews: 1,
  });
  assert.equal(membershipFeatureCap('AI_ESTIMATE', false, limits), 2);
  for (const feature of ['REPLAN', 'PLAN_REVIEW', 'OUTSIDE_REVIEW'] as const)
    assert.equal(membershipFeatureCap(feature, false, limits), 0);
  assert.equal(membershipLimits({ MEMBERSHIP_WEEKLY_ESTIMATES: '12' }).memberEstimates, 12);
  for (const value of ['0', '-1', '1.5', '101', 'abc'])
    assert.throws(() => membershipLimits({ MEMBERSHIP_WEEKLY_ESTIMATES: value }));
  assert.throws(() => membershipLimits({ MEMBERSHIP_LIFESTYLE_CYCLE_SWAPS: '2' }));
  assert.throws(() => membershipLimits({ MEMBERSHIP_LIFESTYLE_CYCLE_SWAPS: '22' }));
  assert.throws(() => membershipLimits({ MEMBERSHIP_HEALTH_CYCLE_SWAPS: '9' }));
  assert.equal(membershipLimits({ MEMBERSHIP_LIFESTYLE_CYCLE_SWAPS: '12' }).lifestyleSwaps, 12);
  // Retired shared caps must not silently reduce the new tier allowances.
  assert.equal(membershipLimits({ MEMBERSHIP_WEEKLY_SWAPS: '6' }).healthSwaps, 21);
});

test('reused entitlement policy rejects unverified, revoked, future and expired paid evidence', () => {
  const grant = {
    id: 'proof',
    source: 'PAID_INVOICE' as const,
    invoiceStatus: 'PAID' as const,
    effectiveFrom: new Date(at.getTime() - 86_400_000),
    effectiveUntil: new Date(at.getTime() + 86_400_000),
  };
  assert.equal(resolveBillingEntitlement({ at, grants: [grant] }).tier, 'PREMIUM');
  assert.equal(resolveBillingEntitlement({ at, grants: [{ ...grant, invoiceStatus: 'OPEN' as never }] }).tier, 'FREE');
  assert.equal(resolveBillingEntitlement({ at, grants: [{ ...grant, revokedAt: at }] }).tier, 'FREE');
  assert.equal(
    resolveBillingEntitlement({ at, grants: [{ ...grant, effectiveFrom: new Date(at.getTime() + 1) }] }).tier,
    'FREE'
  );
  assert.equal(resolveBillingEntitlement({ at, grants: [{ ...grant, effectiveUntil: at }] }).tier, 'FREE');
});

test('swap caps use current paid or trial access and return to Free after expiry', () => {
  const limits = membershipLimits({});
  assert.equal(membershipSwapCap({ enhanced: false, healthAccess: false }, limits), 3);
  assert.equal(membershipSwapCap({ enhanced: true, healthAccess: false }, limits), 10);
  assert.equal(membershipSwapCap({ enhanced: true, healthAccess: true }, limits), 21);
  assert.equal(membershipSwapCap({ enhanced: false, healthAccess: true }, limits), 3);
});

test('whole-plan replacement is retired regardless of membership or old replan overrides', () => {
  assert.doesNotThrow(() => assertMemberPlanPreparation());
  assert.doesNotThrow(() => assertMemberPlanPreparation(false));
  assert.throws(() => assertMemberPlanPreparation(true), { errorCode: 'PLAN_REPLACEMENT_UNAVAILABLE' });
  assert.equal(membershipFeatureCap('REPLAN', true, membershipLimits({ MEMBERSHIP_WEEKLY_REPLANS: '7' })), 0);
  assert.deepEqual(ACTIVE_MEMBERSHIP_FEATURES, ['AI_ESTIMATE', 'PLAN_REVIEW', 'OUTSIDE_REVIEW']);
});

test('existing trial starts receive 30 days without resetting the stored start', () => {
  const originalStart = new Date('2026-09-16T04:00:00.000Z');
  const trial = resolveMembershipLevel({ at, trialStartedAt: originalStart, paidUntil: null });
  assert.equal(trial.level, 'TRIAL');
  assert.equal(trial.trialEndsAt?.toISOString(), '2026-10-16T04:00:00.000Z');
  assert.equal(originalStart.toISOString(), '2026-09-16T04:00:00.000Z');
  assert.equal(
    resolveMembershipLevel({ at: trial.trialEndsAt!, trialStartedAt: originalStart, paidUntil: null }).level,
    'FREE'
  );
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveMembershipLevel } from '../src/domain/membership.policy';
import { quoteTransition, transitionTimeline, type PaidPeriod } from '../src/domain/membership-transition.policy';

const at = new Date('2026-10-15T12:00:00Z');
const lifestyle: PaidPeriod = {
  id: 'paid',
  tier: 'LIFESTYLE',
  period: 'MONTHLY',
  amountCentavos: 24900,
  effectiveFrom: new Date('2026-10-01T12:00:00Z'),
  effectiveUntil: new Date('2026-11-01T12:00:00Z'),
};
const quote = (overrides: Partial<Parameters<typeof quoteTransition>[0]> = {}) =>
  quoteTransition({
    tier: 'LIFESTYLE',
    period: 'MONTHLY',
    periods: [],
    trialEndsAt: null,
    trialPending: false,
    balanceCentavos: 0,
    contextHash: 'fixture',
    at,
    ...overrides,
  });

test('trial purchases preserve Health access and a full paid calendar period', () => {
  const result = quote({ trialEndsAt: new Date('2026-10-20T12:00:00Z') });
  assert.equal(result.action, 'AFTER_TRIAL');
  assert.equal(result.startsAt, '2026-10-20T12:00:00.000Z');
  assert.equal(result.endsAt, '2026-11-20T12:00:00.000Z');
  assert.equal(result.amountCentavos, 24900);
});
test('renewal and downgrade are scheduled after the current paid period', () => {
  const renewal = quote({ periods: [lifestyle], period: 'YEARLY' });
  assert.equal(renewal.action, 'RENEW');
  assert.equal(renewal.endsAt, '2027-11-01T12:00:00.000Z');
  const downgrade = quote({ periods: [{ ...lifestyle, tier: 'HEALTH', amountCentavos: 149900 }] });
  assert.equal(downgrade.action, 'DOWNGRADE');
  assert.equal(downgrade.startsAt, lifestyle.effectiveUntil.toISOString());
  assert.equal(downgrade.creditCentavos, 0);
});
test('immediate upgrade credits unused paid value precisely and keeps excess credit', () => {
  const result = quote({ periods: [lifestyle], tier: 'HEALTH' });
  assert.equal(result.action, 'UPGRADE');
  assert.equal(result.startsAt, at.toISOString());
  assert.equal(result.creditCentavos, Math.floor((24900 * 17) / 31));
  assert.equal(result.amountCentavos + result.creditCentavos, 99900);
  const annual = {
    ...lifestyle,
    period: 'YEARLY' as const,
    amountCentavos: 239000,
    effectiveUntil: new Date('2027-10-01T12:00:00Z'),
  };
  const covered = quote({ periods: [annual], tier: 'HEALTH', balanceCentavos: 1000 });
  assert.equal(covered.amountCentavos, 0);
  assert.equal(covered.creditCentavos + covered.carryoverCentavos, covered.sourceCreditCentavos + 1000);
  assert.ok(covered.carryoverCentavos > 0);
});
test('provider minimum preserves residual credit instead of discarding it', () => {
  const result = quote({ balanceCentavos: 24850 });
  assert.equal(result.amountCentavos, 100);
  assert.equal(result.creditCentavos, 24800);
  assert.equal(result.carryoverCentavos, 50);
});
test('pending trial, scheduled payment and legacy overlapping dates block checkout', () => {
  assert.throws(() => quote({ trialPending: true }), /first usable plan/);
  const next = {
    ...lifestyle,
    id: 'next',
    effectiveFrom: new Date('2026-11-01T12:00:00Z'),
    effectiveUntil: new Date('2026-12-01T12:00:00Z'),
  };
  assert.throws(() => quote({ periods: [lifestyle, next] }), /already paid/);
  assert.throws(() => quote({ periods: [lifestyle, { ...lifestyle, id: 'duplicate' }] }), /reconciliation/);
  assert.equal(transitionTimeline([lifestyle, next], at).conflict, false);
  assert.throws(() => quote({ periods: [lifestyle], trialEndsAt: new Date('2026-10-20T12:00:00Z') }), /reconciliation/);
});

test('a new purchase starts after the full 30-day Health trial', () => {
  const trial = resolveMembershipLevel({ at, trialStartedAt: new Date('2026-10-01T12:00:00Z'), paidUntil: null });
  assert.equal(trial.level, 'TRIAL');
  const result = quote({ trialEndsAt: trial.trialEndsAt });
  assert.equal(result.action, 'AFTER_TRIAL');
  assert.equal(result.startsAt, '2026-10-31T12:00:00.000Z');
  assert.equal(result.endsAt, '2026-11-30T12:00:00.000Z');
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eligibleRoutingReviewer,
  matchingReviewers,
  specialistPool,
  routingOpensAt,
  routingStage,
  SPECIALIST_WINDOW_MS,
  REVIEW_DEADLINE_BUFFER_MS,
  type RoutingReviewer,
} from '../src/domain/review-routing.policy';
import { expertiseSchema } from '../src/validation/review-routing.schemas';

const now = new Date('2026-10-08T01:00:00Z');
function reviewer(id: string, changes: Partial<RoutingReviewer> = {}): RoutingReviewer {
  return {
    id,
    isVerified: true,
    prcLicenseExpiry: new Date('2030-01-01'),
    user: { role: 'NUTRITIONIST', isSuspended: false, emailVerified: true },
    acceptingReviews: true,
    verifiedExpertise: ['HEART_CONDITION', 'DIABETES'],
    verifiedExperienceYears: 8,
    expertiseVerifiedAt: now,
    lastRoutingAssignedAt: null,
    activeClaims: 0,
    ...changes,
  };
}

test('matching requires verified expertise for every condition, not a free-text specialization', () => {
  const matches = matchingReviewers(
    ['HEART_CONDITION', 'DIABETES'],
    [
      reviewer('full'),
      reviewer('partial', { verifiedExpertise: ['HEART_CONDITION'] }),
      reviewer('unverified', { expertiseVerifiedAt: null }),
      reviewer('unknown-years', { verifiedExperienceYears: null }),
      reviewer('unavailable', { acceptingReviews: false }),
    ],
    now
  );
  assert.deepEqual(
    matches.map((item) => item.id),
    ['full']
  );
  assert.deepEqual(matchingReviewers([], [reviewer('full')], now), []);
});

test('ranking uses verified experience, claims, assignment age and a stable final tie', () => {
  const matches = matchingReviewers(
    ['DIABETES'],
    [
      reviewer('junior', { verifiedExperienceYears: 2 }),
      reviewer('busy', { activeClaims: 3 }),
      reviewer('recent', { lastRoutingAssignedAt: now }),
      reviewer('b'),
      reviewer('a'),
      reviewer('senior', { verifiedExperienceYears: 10, activeClaims: 5 }),
    ],
    now
  );
  assert.deepEqual(
    matches.map((item) => item.id),
    ['senior', 'a', 'b', 'recent', 'busy', 'junior']
  );
});

test('eligibility enforces account, license and recruitment activation', () => {
  for (const candidate of [
    reviewer('expired', { prcLicenseExpiry: new Date('2020-01-01') }),
    reviewer('unverified', { isVerified: false }),
    reviewer('suspended', { user: { role: 'NUTRITIONIST', isSuspended: true, emailVerified: true } }),
    reviewer('wrong-role', { user: { role: 'USER', isSuspended: false, emailVerified: true } }),
    reviewer('unverified-email', { user: { role: 'NUTRITIONIST', isSuspended: false, emailVerified: false } }),
    reviewer('unactivated', {
      user: {
        role: 'NUTRITIONIST',
        isSuspended: false,
        emailVerified: true,
        nutritionistApplication: { status: 'INVITED' },
      },
    }),
  ])
    assert.equal(eligibleRoutingReviewer(candidate, now), false, candidate.id);
  assert.equal(eligibleRoutingReviewer(reviewer('active'), now), true);
});

test('pool remains stable and replaces unavailable members with at most three candidates', () => {
  const candidates = [reviewer('new-senior'), reviewer('a'), reviewer('b'), reviewer('c')];
  assert.deepEqual(specialistPool(['a', 'b', 'c'], candidates), ['a', 'b', 'c']);
  assert.deepEqual(specialistPool(['a', 'gone', 'b'], candidates), ['a', 'b', 'new-senior']);
  assert.deepEqual(specialistPool([], []), []);
});

test('deadline buffer shortens the shared maximum and neither later deadlines nor retries extend it', () => {
  const dayLater = new Date(now.getTime() + SPECIALIST_WINDOW_MS);
  assert.equal(routingOpensAt(now, []).getTime(), dayLater.getTime());
  const deadline = new Date(now.getTime() + 6 * 60 * 60_000);
  const shortened = routingOpensAt(now, [deadline]);
  assert.equal(shortened.getTime(), deadline.getTime() - REVIEW_DEADLINE_BUFFER_MS);
  assert.equal(routingOpensAt(now, [dayLater], shortened).getTime(), shortened.getTime());
});

test('no match, unmapped conditions, existing work and approaching deadlines open general access', () => {
  const base = {
    conditions: ['HEART_CONDITION'],
    selectedReviewerIds: ['a'],
    legacy: false,
    unknownConditions: false,
    beganAt: now,
    opensAt: routingOpensAt(now, []),
    now,
  };
  assert.equal(routingStage(base).stage, 'SPECIALIST');
  for (const [change, reason] of [
    [{ selectedReviewerIds: [] }, 'NO_AVAILABLE_MATCH'],
    [{ unknownConditions: true }, 'UNMAPPED_CONDITION'],
    [{ legacy: true }, 'EXISTING_WORK'],
    [{ conditions: [] }, 'NO_CONDITIONS'],
    [{ opensAt: now }, 'DEADLINE_BUFFER'],
    [{ now: new Date(now.getTime() + SPECIALIST_WINDOW_MS) }, 'WINDOW_EXPIRED'],
  ] as const)
    assert.equal(routingStage({ ...base, ...change }).reason, reason);
  assert.equal(routingStage({ ...base, previousStage: 'GENERAL' }).stage, 'GENERAL');
});

test('admin expertise inputs reject NONE, unknown tags, fabricated years and missing evidence', () => {
  const valid = {
    conditions: ['HEART_CONDITION'],
    experienceYears: 0,
    evidence: 'Reviewed synthetic training reference.',
  };
  assert.equal(expertiseSchema.safeParse(valid).success, true);
  for (const change of [
    { conditions: ['NONE'] },
    { conditions: ['UNKNOWN'] },
    { experienceYears: -1 },
    { experienceYears: 1.5 },
    { experienceYears: 71 },
    { experienceYears: null },
    { evidence: '' },
    { acceptingReviews: true },
  ])
    assert.equal(expertiseSchema.safeParse({ ...valid, ...change }).success, false);
  assert.equal(expertiseSchema.safeParse({ ...valid, conditions: [], experienceYears: null }).success, true);
});

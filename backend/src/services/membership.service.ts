import { createHash } from 'node:crypto';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { requiresIndividualPlanningReview } from '@/domain/planning-membership.policy';
import { AppError } from '@/errors/AppError';
import { resolveBillingEntitlement } from '@/domain/billing-entitlement.policy';
import { adaptUserSafetyRestrictions } from '@/domain/structured-restriction.adapter';
import {
  assertMemberPlanPreparation,
  ACTIVE_MEMBERSHIP_FEATURES,
  membershipSwapCap,
  membershipEnabled,
  membershipFeatureCap,
  membershipLimits,
  membershipWeek,
  resolveMembershipLevel,
  MEMBERSHIP_POLICY_VERSION,
  type MembershipFeatureName,
} from '@/domain/membership.policy';
import { getManilaDateKey, getManilaMidnight } from '@/domain/meal-plan-cycle.policy';
import { lockUserProfile } from './profile-revision.service';
import { testCheckoutConfig } from '@/domain/membership-checkout.policy';
import { membershipTransitionView } from './membership-transition.service';

type Client = Prisma.TransactionClient;
const include = { userProfile: true, healthConditions: true, allergies: true, safetyProfileEntries: true };

export class MembershipService {
  static async state(userId: string, at = new Date(), client: Client = prisma) {
    const user = await client.user.findUnique({ where: { id: userId }, include });
    if (!user || user.role !== 'USER' || user.isSuspended)
      throw new AppError('Membership is unavailable for this account.', 403, 'MEMBERSHIP_ACCOUNT_INELIGIBLE');
    // An empty-update Prisma upsert can race on first access. ON CONFLICT preserves
    // the existing trial receipt and remains safe inside admission transactions.
    let account = await client.membershipAccount.findUnique({ where: { userId } });
    if (!account) {
      await client.membershipAccount.createMany({ data: [{ userId }], skipDuplicates: true });
      account = await client.membershipAccount.findUniqueOrThrow({ where: { userId } });
    }
    const grants = await client.membershipGrant.findMany({ where: { userId, verifiedAt: { lte: at } } });
    const checkout = testCheckoutConfig();
    const testPayments = checkout
      ? await client.membershipTestCheckout.findMany({
          where: {
            userId,
            accountHash: checkout.accountHash,
            status: 'PAID',
            verifiedAt: { lte: at },
            revokedAt: null,
          },
        })
      : [];
    // Reuse the historical server-authoritative entitlement resolver, not browser or checkout-return flags.
    const resolve = (tier: 'LIFESTYLE' | 'HEALTH') =>
      resolveBillingEntitlement({
        at,
        grants: [
          ...grants,
          ...testPayments.flatMap((row) =>
            row.effectiveFrom && row.effectiveUntil
              ? [
                  {
                    id: row.id,
                    tier: row.tier,
                    source: 'PAID_INVOICE',
                    effectiveFrom: row.effectiveFrom,
                    effectiveUntil:
                      row.supersededAt && row.supersededAt < row.effectiveUntil ? row.supersededAt : row.effectiveUntil,
                    revokedAt: row.revokedAt,
                  },
                ]
              : []
          ),
        ]
          .filter(
            (grant) =>
              (grant.tier ?? 'HEALTH') === tier &&
              (grant.source === 'PAID_INVOICE' || grant.source === 'ADMIN_ADJUSTMENT')
          )
          .map((grant) => ({
            id: grant.id,
            source: grant.source === 'PAID_INVOICE' ? ('PAID_INVOICE' as const) : ('ADMIN_ADJUSTMENT' as const),
            invoiceStatus: grant.source === 'PAID_INVOICE' ? ('PAID' as const) : null,
            effectiveFrom: grant.effectiveFrom,
            effectiveUntil: grant.effectiveUntil,
            revokedAt: grant.revokedAt,
          })),
      });
    const health = resolve('HEALTH');
    const lifestyle = resolve('LIFESTYLE');
    const paidUntil = [health.effectiveUntil, lifestyle.effectiveUntil].reduce<Date | null>(
      (latest, end) => (end && (!latest || end > latest) ? end : latest),
      null
    );
    const current = resolveMembershipLevel({
      at,
      trialStartedAt: account.trialStartedAt,
      paidUntil,
    });
    const healthUntil = [
      health.effectiveUntil,
      current.trialEndsAt && current.trialEndsAt > at ? current.trialEndsAt : null,
    ].reduce<Date | null>((latest, end) => (end && (!latest || end > latest) ? end : latest), null);
    const healthAccess = account.trialStartedAt === null || Boolean(healthUntil);
    const tier = healthAccess ? 'HEALTH' : current.enhanced ? 'LIFESTYLE' : 'FREE';
    const restrictions = adaptUserSafetyRestrictions({
      healthConditions: user.healthConditions.map((row) => row.condition),
      allergies: user.allergies.map((row) => row.allergen),
      safetyEntries: user.safetyProfileEntries,
      otherConditions: user.userProfile?.otherConditions,
      otherAllergies: user.userProfile?.otherAllergies,
    });
    const requiresCaseReview = requiresIndividualPlanningReview(restrictions);
    return {
      ...current,
      tier,
      healthAccess,
      healthUntil,
      account,
      paidUntil,
      requiresCaseReview,
      user,
    };
  }

  /** First observed actionable current plan starts a single durable trial. Never start on pending/future rows. */
  static async startTrial(userId: string, availableAt: Date, at = new Date()) {
    if (!membershipEnabled()) return;
    const existing = await prisma.membershipAccount.findUnique({ where: { userId }, select: { trialStartedAt: true } });
    if (existing?.trialStartedAt) return;
    await prisma.$transaction(async (tx) => {
      await lockUserProfile(tx, userId);
      await tx.membershipAccount.createMany({ data: [{ userId }], skipDuplicates: true });
      const account = await tx.membershipAccount.findUniqueOrThrow({ where: { userId } });
      const start = new Date(Math.max(account.createdAt.getTime(), Math.min(availableAt.getTime(), at.getTime())));
      await tx.membershipAccount.updateMany({
        where: { userId, trialStartedAt: null },
        data: { trialStartedAt: start },
      });
    });
  }

  static async assertEnhanced(userId: string, client: Client = prisma) {
    if (!membershipEnabled()) return;
    const state = await this.state(userId, new Date(), client);
    if (!state.enhanced)
      throw new AppError(
        'This feature requires Lifestyle or Health membership. Your saved records and profile corrections remain available.',
        403,
        'MEMBERSHIP_REQUIRED'
      );
  }

  static async assertHealth(userId: string, client: Client = prisma) {
    if (!membershipEnabled()) return;
    if (!(await this.state(userId, new Date(), client)).healthAccess)
      throw new AppError(
        'Health membership is required for updated case planning and nutritionist review.',
        403,
        'HEALTH_MEMBERSHIP_REQUIRED'
      );
  }

  static async assertNewPlan(userId: string, startsAt: Date, client: Client = prisma) {
    if (!membershipEnabled()) return;
    const at = new Date();
    const state = await this.state(userId, at, client);
    if (!state.requiresCaseReview) return;
    // A safety correction may repair the existing active cycle after expiry, never open another week.
    if (await this.isSafetyRepair(userId, startsAt, client, at)) return;
    this.assertCasePlanAccess(state, startsAt);
  }

  private static assertCasePlanAccess(state: Awaited<ReturnType<typeof MembershipService.state>>, startsAt: Date) {
    const accessEnd = state.healthUntil;
    if (!state.healthAccess || (accessEnd && getManilaMidnight(getManilaDateKey(startsAt)) >= accessEnd))
      throw new AppError(
        'Health membership is required for a new plan with case review. Existing eligible active meals remain available.',
        403,
        'CASE_MEMBERSHIP_REQUIRED'
      );
  }

  static async isSafetyRepair(userId: string, startsAt: Date, client: Client, at = new Date()) {
    const cycle = await client.mealPlanCycle.findFirst({
      where: {
        userId,
        startDate: { equals: startsAt, lte: at },
        endDate: { gte: getManilaMidnight(getManilaDateKey(at)) },
        status: { notIn: ['SUPERSEDED', 'COMPLETED'] },
      },
      select: { id: true, profileAdaptationState: true, pendingProfileChangeKinds: true },
    });
    const admitted = cycle
      ? await client.membershipUsage.findFirst({
          where: { userId, feature: 'PLAN_REVIEW', resultEntityId: cycle.id, completedAt: { not: null } },
        })
      : null;
    return Boolean(
      admitted &&
      cycle &&
      (cycle.profileAdaptationState === 'SAFETY_REVALIDATION_REQUIRED' ||
        cycle.pendingProfileChangeKinds.includes('SAFETY'))
    );
  }

  static async assertSwap(userId: string, cycleId: string, client: Client) {
    if (!membershipEnabled()) return;
    const state = await this.state(userId, new Date(), client);
    const limits = membershipLimits();
    const cap = membershipSwapCap(state, limits);
    const cycle = await client.mealPlanCycle.findFirstOrThrow({
      where: { id: cycleId, userId },
      select: { startDate: true, planType: true },
    });
    const used = await client.swapLog.count({
      where: { mealPlan: { userId, cycle: { userId, startDate: cycle.startDate, planType: cycle.planType } } },
    });
    if (used >= cap)
      throw new AppError(
        `You have used all ${cap} swaps for this plan week. View membership for your allowance.`,
        429,
        'MEMBERSHIP_SWAP_LIMIT'
      );
    return { limit: cap, used };
  }

  /** Reservations serialize per account and count toward limits while a provider request is in flight. */
  static async reserve(
    userId: string,
    feature: MembershipFeatureName,
    requestKey: string,
    payload: string,
    client: Client,
    at = new Date(),
    targetWeekAt?: Date
  ) {
    if (feature === 'REPLAN') assertMemberPlanPreparation(true);
    if (!membershipEnabled()) return null;
    await lockUserProfile(client, userId);
    const state = await this.state(userId, at, client);
    return this.reserveWithLockedState(userId, feature, requestKey, payload, client, state, at, targetWeekAt);
  }

  // Only call after taking the profile lock and reading membership on this same
  // transaction. Admission can reserve two features without reloading entitlement.
  private static async reserveWithLockedState(
    userId: string,
    feature: MembershipFeatureName,
    requestKey: string,
    payload: string,
    client: Client,
    state: Awaited<ReturnType<typeof MembershipService.state>>,
    at: Date,
    targetWeekAt?: Date
  ) {
    const payloadHash = createHash('sha256').update(payload).digest('hex');
    const prior = await client.membershipUsage.findUnique({
      where: { userId_feature_requestKey: { userId, feature, requestKey } },
    });
    if (prior) {
      if (prior.payloadHash !== payloadHash)
        throw new AppError('This request key belongs to different details.', 409, 'REQUEST_KEY_COLLISION');
      if (prior.completedAt) return { id: prior.id, replayed: true };
      if (prior.reservedUntil > at)
        throw new AppError(
          'This request is already being prepared. Please wait.',
          409,
          'MEMBERSHIP_REQUEST_IN_PROGRESS'
        );
      await client.membershipUsage.delete({ where: { id: prior.id } });
    }
    const window = membershipWeek(targetWeekAt ?? at);
    const cap = membershipFeatureCap(feature, state.enhanced, membershipLimits(), state.healthAccess);
    const used = await client.membershipUsage.count({
      where: {
        userId,
        feature,
        windowStart: window.start,
        OR: [{ completedAt: { not: null } }, { reservedUntil: { gt: at } }],
      },
    });
    if (used >= cap)
      throw new AppError(
        cap === 0
          ? 'Health membership is required. Follow-up on an existing review remains available.'
          : `Your weekly ${feature.toLowerCase().replace(/_/g, ' ')} allowance is used. It resets ${window.end.toISOString()}.`,
        cap === 0 ? 403 : 429,
        cap === 0 ? 'MEMBERSHIP_REQUIRED' : 'MEMBERSHIP_USAGE_LIMIT'
      );
    const row = await client.membershipUsage.create({
      data: {
        userId,
        feature,
        requestKey,
        payloadHash,
        windowStart: window.start,
        windowEnd: window.end,
        reservedUntil: new Date(at.getTime() + 30 * 60_000),
      },
    });
    return { id: row.id, replayed: false };
  }

  static async complete(id: string | null | undefined, client: Client = prisma, resultEntityId?: string) {
    if (!id) return;
    const result = await client.membershipUsage.updateMany({
      where: { id, completedAt: null, reservedUntil: { gt: new Date() } },
      data: { completedAt: new Date(), resultEntityId },
    });
    if (result.count !== 1)
      throw new AppError(
        'The request reservation expired. Retry with a new request.',
        409,
        'MEMBERSHIP_RESERVATION_EXPIRED'
      );
  }

  static async release(id: string | null | undefined) {
    if (id) await prisma.membershipUsage.deleteMany({ where: { id, completedAt: null } });
  }

  static async admitPlan(userId: string, startsAt: Date, replaceExisting: boolean, jobId: string, requestKey?: string) {
    if (!membershipEnabled()) return [];
    // Remote database round trips can exceed Prisma's five-second default.
    // This bounded allowance is specific to admission; recipe/AI work stays outside.
    return prisma.$transaction(
      async (tx) => {
        await lockUserProfile(tx, userId);
        const at = new Date();
        const state = await this.state(userId, at, tx);
        const reservations: Array<{ id: string; replayed: boolean }> = [];
        const safetyRepair = await this.isSafetyRepair(userId, startsAt, tx, at);
        if (state.requiresCaseReview && !safetyRepair) this.assertCasePlanAccess(state, startsAt);
        if (state.requiresCaseReview && !safetyRepair) {
          const week = membershipWeek(startsAt);
          // Internal rebuilds keep case-review admission; admitted safety repair remains free.
          // Members change individual meals through swaps, without replan credits.
          const key = `plan:${week.start.toISOString()}${replaceExisting ? `:replacement:${requestKey ?? jobId}` : ''}`;
          const row = await this.reserveWithLockedState(userId, 'PLAN_REVIEW', key, key, tx, state, at, startsAt);
          if (row && !row.replayed) reservations.push(row);
        }
        return reservations;
      },
      { maxWait: 10_000, timeout: 30_000 }
    );
  }

  static async view(userId: string, at = new Date()) {
    if (!membershipEnabled()) return { enabled: false as const };
    const state = await this.state(userId, at);
    const window = membershipWeek(at);
    const rows = await prisma.membershipUsage.groupBy({
      by: ['feature'],
      where: { userId, windowStart: window.start, OR: [{ completedAt: { not: null } }, { reservedUntil: { gt: at } }] },
      _count: { _all: true },
    });
    const limits = membershipLimits();
    const usage = Object.fromEntries(
      ACTIVE_MEMBERSHIP_FEATURES.map((feature) => {
        const cap = membershipFeatureCap(feature, state.enhanced, limits, state.healthAccess);
        const used = rows.find((row) => row.feature === feature)?._count._all ?? 0;
        return [feature, { used, cap, remaining: Math.max(0, cap - used) }];
      })
    );
    const cycle = await prisma.mealPlanCycle.findFirst({
      where: {
        userId,
        startDate: { lte: at },
        endDate: { gte: getManilaMidnight(getManilaDateKey(at)) },
        status: { notIn: ['SUPERSEDED', 'COMPLETED'] },
      },
      orderBy: { cycleRevision: 'desc' },
      select: { id: true, endDate: true, startDate: true, planType: true },
    });
    const swapsUsed = cycle
      ? await prisma.swapLog.count({
          where: { mealPlan: { userId, cycle: { userId, startDate: cycle.startDate, planType: cycle.planType } } },
        })
      : 0;
    const swapsCap = membershipSwapCap(state, limits);
    const checkoutConfig = testCheckoutConfig();
    const scheduledMemberships = checkoutConfig
      ? await prisma.membershipTestCheckout.findMany({
          where: {
            userId,
            accountHash: checkoutConfig.accountHash,
            status: 'PAID',
            revokedAt: null,
            effectiveFrom: { gt: at },
            supersededAt: null,
          },
          select: { id: true, tier: true, effectiveFrom: true, effectiveUntil: true },
          orderBy: { effectiveFrom: 'asc' },
        })
      : [];
    return {
      enabled: true as const,
      policyVersion: MEMBERSHIP_POLICY_VERSION,
      serverTime: at.toISOString(),
      level: state.level,
      enhanced: state.enhanced,
      tier: state.tier,
      healthAccess: state.healthAccess,
      healthUntil: state.healthUntil?.toISOString() ?? null,
      requiresCaseReview: state.requiresCaseReview,
      trialStartedAt: state.account.trialStartedAt?.toISOString() ?? null,
      trialEndsAt: state.trialEndsAt?.toISOString() ?? null,
      paidUntil: state.paidUntil?.toISOString() ?? null,
      resetsAt: window.end.toISOString(),
      purchasesAvailable: Boolean(testCheckoutConfig()),
      checkoutMode: 'TEST' as const,
      scheduledMemberships,
      transitions: await membershipTransitionView(userId, at),
      price: null,
      autoRenews: false,
      limits,
      usage,
      swaps: { used: swapsUsed, cap: swapsCap, remaining: Math.max(0, swapsCap - swapsUsed) },
    };
  }
}

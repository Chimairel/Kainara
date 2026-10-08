import { MEMBERSHIP_TRIAL_DAYS } from './membership.policy';

export type MembershipHistoryRecord = {
  id: string;
  kind: 'TRIAL' | 'GRANT' | 'CHECKOUT';
  tier: string;
  period: string | null;
  source: string;
  recordedAt: Date;
  startsAt: Date | null;
  endsAt: Date | null;
  verifiedAt: Date | null;
  revokedAt: Date | null;
  supersededAt: Date | null;
  amountCentavos: number | null;
  currency: string | null;
  currentConfiguration: boolean;
};

export function membershipHistoryEntry(record: MembershipHistoryRecord, at: Date) {
  const trial = record.kind === 'TRIAL';
  const endsAt = trial
    ? record.startsAt
      ? new Date(record.startsAt.getTime() + MEMBERSHIP_TRIAL_DAYS * 86_400_000)
      : null
    : record.endsAt;
  const status =
    trial && !record.startsAt
      ? 'NOT_STARTED'
      : record.source === 'REVIEW'
        ? 'PAYMENT_REVIEW'
        : record.revokedAt && record.revokedAt <= at
          ? 'REVOKED'
          : record.supersededAt && record.supersededAt <= at
            ? 'REPLACED'
            : !trial && (!record.verifiedAt || record.verifiedAt > at || !record.startsAt || !endsAt)
              ? 'UNCONFIRMED'
              : record.kind === 'CHECKOUT' && !record.currentConfiguration
                ? 'RECORDED'
                : endsAt && endsAt <= at
                  ? 'ENDED'
                  : record.startsAt && record.startsAt > at
                    ? 'SCHEDULED'
                    : 'ACTIVE';
  return {
    id: record.id,
    plan: trial ? 'Free Health Plan' : record.tier === 'HEALTH' ? 'Health' : 'Lifestyle',
    period: trial
      ? `${MEMBERSHIP_TRIAL_DAYS} days`
      : record.period === 'MONTHLY'
        ? 'Monthly'
        : record.period === 'YEARLY'
          ? 'Yearly'
          : 'Recorded period',
    source: trial
      ? 'Introductory access'
      : record.kind === 'CHECKOUT'
        ? 'Test checkout'
        : record.source === 'ADMIN_ADJUSTMENT'
          ? 'Admin adjustment'
          : 'Verified payment grant',
    status,
    recordedAt: record.recordedAt.toISOString(),
    startsAt: record.startsAt?.toISOString() ?? null,
    endsAt: endsAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    supersededAt: record.supersededAt?.toISOString() ?? null,
    amountCentavos: record.amountCentavos,
    currency: record.currency,
    note:
      status === 'NOT_STARTED'
        ? 'Starts with the first usable meal plan. No start date has been recorded.'
        : status === 'PAYMENT_REVIEW'
          ? 'Payment needs reconciliation; this record does not grant membership access.'
          : status === 'UNCONFIRMED'
            ? 'A confirmed membership period is not recorded.'
            : status === 'RECORDED'
              ? 'Preserved test payment from a different or disabled checkout configuration; it does not grant current access.'
              : trial
                ? 'The end date follows the existing 30-day introductory policy.'
                : null,
  };
}

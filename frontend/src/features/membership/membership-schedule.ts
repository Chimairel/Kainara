import type { MembershipView } from './MembershipProvider';

export type MembershipSchedule = {
  id: string;
  label: string;
  start: string | null;
  end: string | null;
  message: string;
};

export function membershipSchedules(data: Extract<MembershipView, { enabled: true }>): MembershipSchedule[] {
  const current = data.transitions?.current;
  const active: MembershipSchedule =
    data.level === 'TRIAL' || data.level === 'TRIAL_PENDING'
      ? {
          id: 'current',
          label: 'Current: Health',
          start: data.trialStartedAt,
          end: data.trialEndsAt,
          message:
            data.level === 'TRIAL_PENDING'
              ? 'Health starts when your first usable plan is available. Your 30 days have not started.'
              : 'Health is active for 30 days. Moving to a full weekly meal plan does not restart this period.',
        }
      : data.level === 'MEMBER'
        ? {
            id: 'current',
            label: `Current: ${data.tier === 'LIFESTYLE' ? 'Lifestyle' : 'Health'}`,
            start: current?.effectiveFrom ?? null,
            end: current?.effectiveUntil ?? data.paidUntil,
            message: 'Membership expires at the time shown. Renewal requires another payment.',
          }
        : { id: 'current', label: 'Current: Free', start: null, end: null, message: 'Free has no expiry.' };
  return [
    active,
    ...(data.transitions?.scheduled ?? data.scheduledMemberships ?? []).map((plan) => ({
      id: plan.id,
      label: `Next: ${plan.tier === 'HEALTH' ? 'Health' : 'Lifestyle'} · Already paid`,
      start: plan.effectiveFrom,
      end: plan.effectiveUntil,
      message: 'Already paid. This plan starts automatically at the time shown; no additional charge is needed.',
    })),
  ];
}

export function manilaDate(value: string | Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

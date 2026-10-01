'use client';

import Link from 'next/link';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Button from '@/components/ui/Button';
import { useMembership } from '@/features/membership/MembershipProvider';

const date = (value: string) =>
  new Date(value).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export default function MembershipPage() {
  const { data, isLoading, error, refresh } = useMembership();
  if (isLoading && !data)
    return (
      <p className="portal-page" role="status">
        Loading membership…
      </p>
    );
  if (error && !data)
    return (
      <div className="portal-page">
        <p role="alert">{error}</p>
        <Button onClick={refresh}>Retry</Button>
      </div>
    );
  if (!data?.enabled)
    return (
      <div className="portal-page">
        <PortalPageHeader
          title="Membership"
          description="Membership is being prepared. Your current access has not changed."
        />
      </div>
    );
  const labels = {
    FREE: 'Free account',
    TRIAL_PENDING: 'Trial waiting for your first usable plan',
    TRIAL: '14-day membership trial',
    MEMBER: 'Active membership',
  };
  const rows = [
    ['Weekly general meal plans (no declared conditions or allergies)', 'Based on your starting profile', 'Included'],
    ['Optional goal, food preference and shopping updates', '—', 'Included'],
    ['Meal swaps per plan week', String(data.limits.freeSwaps), String(data.limits.memberSwaps)],
    [
      'AI outside-meal estimate requests per week',
      String(data.limits.freeEstimates),
      String(data.limits.memberEstimates),
    ],
    ['Optional replans per week', '—', String(data.limits.memberReplans)],
    ['Progress insights', '—', 'Included'],
    ['Plan-review episodes per target plan week', 'Trial access', String(data.limits.memberPlanReviews)],
    ['Requested outside-meal review episodes per week', 'Trial access', String(data.limits.memberOutsideReviews)],
  ];
  return (
    <div className="portal-page mx-auto max-w-5xl space-y-5 pb-28">
      <PortalPageHeader
        title="KAINARA membership"
        description="Keep your weekly meals practical. Membership adds adaptation, progress insights and professional review when required."
      />
      <section className="rounded-2xl border border-brand-border bg-brand-surface p-5">
        <h2 className="font-display text-xl font-bold">{labels[data.level]}</h2>
        <p className="mt-2 text-sm text-brand-muted">
          {data.level === 'TRIAL_PENDING'
            ? 'Your trial starts when your first cleared current plan is available. A starter plan counts; waiting for review does not.'
            : data.level === 'MEMBER' && data.paidUntil
              ? `Membership available until ${date(data.paidUntil)}. No automatic renewal.`
              : data.trialEndsAt
                ? `Trial ${data.level === 'FREE' ? 'ended' : 'ends'} ${date(data.trialEndsAt)}. Moving to a full weekly plan does not restart it.`
                : ''}
        </p>
        {data.requiresCaseReview && data.level === 'FREE' && (
          <p className="mt-3 text-sm text-status-pending-text">
            New plans with case review require membership. Existing eligible active meals and previously submitted
            review follow-up remain available.
          </p>
        )}
      </section>
      <section className="rounded-2xl border border-brand-border bg-brand-surface p-5">
        <h2 className="font-display text-lg font-bold">Your remaining allowances</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <p>
            Meal swaps:{' '}
            <strong>
              {data.swaps.remaining} of {data.swaps.cap}
            </strong>{' '}
            for your current cycle
          </p>
          {(['AI_ESTIMATE', 'REPLAN', 'PLAN_REVIEW', 'OUTSIDE_REVIEW'] as const).map((feature) => (
            <p key={feature}>
              {
                {
                  AI_ESTIMATE: 'AI estimate requests',
                  REPLAN: 'Optional replans',
                  PLAN_REVIEW: 'Plan-review episodes',
                  OUTSIDE_REVIEW: 'Outside-meal review episodes',
                }[feature]
              }
              :{' '}
              <strong>
                {data.usage[feature].remaining} of {data.usage[feature].cap}
              </strong>
            </p>
          ))}
        </div>
        <p className="mt-3 text-xs text-brand-muted">
          Estimate, replan and outside-review allowances reset Monday in Manila: {date(data.resetsAt)}. Swaps follow
          each plan cycle; plan review follows its target week. An optional replan that needs new case review also uses
          a plan-review allowance.
        </p>
      </section>
      <section className="overflow-hidden rounded-2xl border border-brand-border bg-brand-surface">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="p-5 text-left font-display text-lg font-bold">
              One membership, the same allowances for every subscriber
            </caption>
            <thead>
              <tr className="border-y border-brand-border">
                <th className="p-4">Benefit</th>
                <th className="p-4">Free</th>
                <th className="p-4">Membership / trial</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([feature, free, member]) => (
                <tr key={feature} className="border-b border-brand-border last:border-0">
                  <th className="p-4 font-medium">{feature}</th>
                  <td className="p-4">{free}</td>
                  <td className="p-4">{member}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-2xl border border-brand-border bg-brand-surface p-5">
        <h2 className="font-display text-lg font-bold">Membership purchases are not available yet</h2>
        <p className="mt-2 text-sm text-brand-muted">
          Pricing and payment setup are being finalized. No payment details are collected and no automatic charges
          occur.
        </p>
        <Button disabled className="mt-4">
          Purchases opening soon
        </Button>
      </section>
      <p className="text-sm leading-relaxed text-brand-muted">
        Health corrections, safety checks, manual meal logging, groceries and access to existing records remain
        available. Review can approve, request changes or decline; membership does not guarantee verification or
        continuous monitoring. Corrections needed to finish an existing review do not spend another allowance. Saved
        estimates remain estimates unless reviewed.
      </p>
      <Link href="/profile/health" className="inline-block font-bold text-brand-green">
        Update health information →
      </Link>
    </div>
  );
}

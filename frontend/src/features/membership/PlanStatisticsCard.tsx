'use client';

import Card from '@/components/ui/Card';
import type { MembershipView } from './MembershipProvider';
import { formatMembershipDate } from './MembershipPlanHeader';

export default function PlanStatisticsCard({ data }: { data: Extract<MembershipView, { enabled: true }> }) {
  const allowances = [
    { name: 'Meal swaps', period: 'This cycle', ...data.swaps },
    { name: 'Outside-food AI estimates', period: 'This week', ...data.usage.AI_ESTIMATE },
    ...(data.assistant?.enabled && data.assistant.allowance
      ? [{ name: 'Nara AI credits', period: 'This week · separate from outside-food estimates', ...data.assistant.allowance }] : []),
    { name: 'Plan reviews', period: 'Target week', ...data.usage.PLAN_REVIEW },
    { name: 'Outside reviews', period: 'This week', ...data.usage.OUTSIDE_REVIEW },
  ];

  return (
    <Card aria-label="Allowances and usage statistics" className="p-6 sm:p-8">
      <h2 className="font-display text-xl font-bold text-brand-text">Remaining allowances</h2>
      <dl className="mt-5 divide-y divide-brand-border">
        {allowances.map((item) => (
          <div key={item.name} className="flex items-center justify-between gap-4 py-4">
            <div>
              <dt className="text-sm font-semibold text-brand-text">{item.name}</dt>
              <p className="mt-1 text-xs text-brand-muted">{item.period}</p>
            </div>
            <dd
              className="shrink-0 font-display text-xl font-semibold tabular-nums text-brand-text"
              aria-label={`${item.name}: ${item.remaining} of ${item.cap} remaining`}
            >
              {item.remaining} <span className="text-sm font-normal text-brand-muted">/ {item.cap}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-brand-muted">Weekly reset: {formatMembershipDate(data.resetsAt)}</p>
    </Card>
  );
}

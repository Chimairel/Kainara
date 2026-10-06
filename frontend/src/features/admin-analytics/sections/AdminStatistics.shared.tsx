import type { LucideIcon } from 'lucide-react';
import { CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';

import { cn } from '@/lib/utils';

export type AnalyticsTab = 'totals' | 'review-signals' | 'ai-activity';
export const humanize = (value: string) => value.toLowerCase().replaceAll('_', ' ');
export const format = (value: number) => value.toLocaleString();
export function HeroMetricCard({
  label,
  count,
  note,
  href,
  icon: Icon,
  badgeTone = 'emerald',
}: {
  label: string;
  count: number;
  note: string;
  href?: string;
  icon: LucideIcon;
  badgeTone?: 'emerald' | 'teal' | 'amber' | 'blue';
}) {
  const badgeClasses = {
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    blue: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  }[badgeTone];

  return (
    <Card variant="metric" className="flex flex-col justify-between p-5 sm:p-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', badgeClasses)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-wider text-brand-muted">{label}</p>
        <p className="mt-1 font-display text-3xl sm:text-4xl font-black tracking-tight text-brand-text">
          {format(count)}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-brand-muted">{note}</p>
      </div>
      {href && (
        <div className="mt-4 border-t border-brand-border/40 pt-3">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-brand-green hover:underline"
          >
            <span>View records</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}
    </Card>
  );
}
export function SignalCard({
  label,
  count,
  note,
  href,
  icon: Icon,
  statusType = 'neutral',
}: {
  label: string;
  count: number;
  note: string;
  href?: string;
  icon: LucideIcon;
  statusType?: 'zero-good' | 'queue' | 'neutral';
}) {
  const isAlert = statusType === 'zero-good' && count > 0;
  const isHealthy = statusType === 'zero-good' && count === 0;

  return (
    <div
      className={cn(
        'flex flex-col justify-between rounded-2xl border p-4 transition-all',
        isAlert
          ? 'border-red-500/30 bg-red-500/5 dark:bg-red-950/20'
          : 'border-brand-border/60 bg-brand-bgAlt/30 hover:border-brand-border'
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-xl text-xs',
              isAlert ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-brand-surface text-brand-muted shadow-xs'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          {isHealthy && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> All clear
            </span>
          )}
          {isAlert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400">
              <AlertTriangle className="h-3 w-3" /> Attention
            </span>
          )}
          {statusType === 'queue' && count > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              Active
            </span>
          )}
        </div>
        <p className="mt-3 text-xs font-bold text-brand-muted">{label}</p>
        <p className="mt-1 font-display text-2xl font-black text-brand-text">{format(count)}</p>
        <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">{note}</p>
      </div>
      {href && (
        <div className="mt-3 border-t border-brand-border/40 pt-2">
          <Link
            href={href}
            className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green hover:underline"
          >
            View records →
          </Link>
        </div>
      )}
    </div>
  );
}

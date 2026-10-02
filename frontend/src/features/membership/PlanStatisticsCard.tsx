'use client';

import { useMemo } from 'react';
import { ArrowRight, BarChart3 } from 'lucide-react';
import type { MembershipView } from './MembershipProvider';

interface PlanStatisticsCardProps {
  data: Extract<MembershipView, { enabled: true }>;
  onOpenPlans: () => void;
}

export default function PlanStatisticsCard({ data, onOpenPlans }: PlanStatisticsCardProps) {
  const stats = useMemo(() => {
    return [
      {
        id: 'swaps',
        name: 'Meal swaps',
        cadence: 'Cycle',
        used: data.swaps.used,
        cap: data.swaps.cap,
        remaining: data.swaps.remaining,
        // Emerald / Teal theme
        numColor: 'text-emerald-500 dark:text-emerald-400',
        barGradient: 'from-emerald-600 to-emerald-500',
        borderColor: 'border-emerald-500/30',
      },
      {
        id: 'ai_estimate',
        name: 'AI estimates',
        cadence: 'Weekly',
        used: data.usage.AI_ESTIMATE.used,
        cap: data.usage.AI_ESTIMATE.cap,
        remaining: data.usage.AI_ESTIMATE.remaining,
        // Terracotta / Orange theme (Brand accent)
        numColor: 'text-orange-500 dark:text-orange-400',
        barGradient: 'from-orange-600 to-orange-500',
        borderColor: 'border-orange-500/30',
      },
      {
        id: 'replan',
        name: 'Replans',
        cadence: 'Weekly',
        used: data.usage.REPLAN.used,
        cap: data.usage.REPLAN.cap,
        remaining: data.usage.REPLAN.remaining,
        // Sky Blue theme
        numColor: 'text-sky-500 dark:text-sky-400',
        barGradient: 'from-sky-600 to-sky-500',
        borderColor: 'border-sky-500/30',
      },
      {
        id: 'plan_review',
        name: 'Plan reviews',
        cadence: 'Target week',
        used: data.usage.PLAN_REVIEW.used,
        cap: data.usage.PLAN_REVIEW.cap,
        remaining: data.usage.PLAN_REVIEW.remaining,
        // Violet / Purple theme
        numColor: 'text-purple-500 dark:text-purple-400',
        barGradient: 'from-purple-600 to-purple-500',
        borderColor: 'border-purple-500/30',
      },
      {
        id: 'outside_review',
        name: 'Outside reviews',
        cadence: 'Weekly',
        used: data.usage.OUTSIDE_REVIEW.used,
        cap: data.usage.OUTSIDE_REVIEW.cap,
        remaining: data.usage.OUTSIDE_REVIEW.remaining,
        // Lime / Green theme
        numColor: 'text-lime-500 dark:text-lime-400',
        barGradient: 'from-lime-600 to-lime-500',
        borderColor: 'border-lime-500/30',
      },
    ];
  }, [data]);

  const resetDate = new Date(data.resetsAt).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
  });

  return (
    <section
      aria-label="Allowances and usage statistics"
      className="rounded-2xl border border-brand-border bg-brand-surface p-5 sm:p-6 shadow-xs flex flex-col justify-between"
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-brand-border/60">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-bgAlt border border-brand-border text-brand-green">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-brand-text">
                Plan Statistics
              </h3>
              <p className="text-xs text-brand-muted">
                Usage tracking for your active cycle
              </p>
            </div>
          </div>
          <span className="rounded-full bg-brand-bgAlt border border-brand-border/70 px-2.5 py-1 text-[10px] font-mono font-medium text-brand-muted">
            Resets {resetDate}
          </span>
        </div>

        {/* Peeking Numbers Section (Reference Image 4) */}
        <div className="pt-4 pb-1">
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3 text-center">
            {stats.map((item) => (
              <div key={item.id} className="flex flex-col items-center">
                <span
                  title={`Max capacity: ${item.cap}`}
                  className={`font-display font-extrabold text-2xl sm:text-3xl tracking-tight leading-none drop-shadow-xs transition-transform hover:-translate-y-1 ${item.numColor}`}
                >
                  {String(item.cap).padStart(2, '0')}
                </span>
              </div>
            ))}
          </div>

          {/* Paper Slit / Pocket Lip with Drop Shadow (Reference Image 4 & 5) */}
          <div className="relative mt-1 mb-5">
            <div className="h-1 w-full rounded-full bg-brand-border/70 shadow-[0_4px_8px_-1px_rgba(0,0,0,0.18)] dark:shadow-[0_4px_8px_-1px_rgba(0,0,0,0.5)]" />
          </div>

          {/* Capsule Vertical Pill Bars Section (Reference Image 3 & 5) */}
          <div className="grid grid-cols-5 gap-1.5 sm:gap-3 items-end pt-1">
            {stats.map((item) => {
              // Percentage calculation
              const rawPct = item.cap > 0 ? (item.used / item.cap) * 100 : 0;
              // If used > 0, give minimum visible height of 22% so the usage number fits comfortably
              const fillHeightPct = item.used > 0 ? Math.max(22, Math.min(100, rawPct)) : 0;

              return (
                <div key={item.id} className="flex flex-col items-center group">
                  {/* The Capsule Pill Bar */}
                  <div
                    className="relative w-11 sm:w-13 md:w-15 h-44 sm:h-52 rounded-full overflow-hidden border border-brand-border/60 shadow-inner flex flex-col justify-end"
                    style={{
                      // Diagonal striped pattern for unfilled capacity
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(120, 140, 130, 0.12) 5px, rgba(120, 140, 130, 0.12) 10px)',
                    }}
                  >
                    {/* Filled bar representing Usage (rising from bottom) */}
                    <div
                      className={`w-full bg-gradient-to-t ${item.barGradient} rounded-full transition-all duration-700 ease-out flex items-center justify-center relative shadow-sm`}
                      style={{
                        height: `${fillHeightPct}%`,
                        minHeight: item.used > 0 ? '2.25rem' : '0',
                      }}
                    >
                      {/* Inside the graph: Usage number */}
                      {item.used > 0 && (
                        <span className="text-white font-display font-bold text-xs sm:text-sm drop-shadow-sm select-none">
                          {item.used}
                        </span>
                      )}
                    </div>

                    {/* Display 0 at the base if 0 used */}
                    {item.used === 0 && (
                      <div className="h-7 w-full flex items-center justify-center">
                        <span className="text-brand-muted/70 font-display font-semibold text-xs select-none">
                          0
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Labels at bottom */}
                  <div className="mt-2.5 text-center w-full px-0.5">
                    <span
                      title={item.name}
                      className="block text-[10px] sm:text-xs font-semibold text-brand-text text-center leading-tight min-h-[1.75rem] flex items-center justify-center"
                    >
                      {item.name}
                    </span>
                    <span className="block text-[9px] text-brand-muted font-mono mt-0.5 uppercase tracking-wider">
                      {item.cadence}
                    </span>
                    {/* Remaining readout satisfying Vitest '6 of 10' assertion */}
                    <span className="block text-[10px] text-brand-muted mt-0.5 font-medium">
                      {item.remaining} of {item.cap}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info & View plans link */}
      <div className="mt-4 pt-3 border-t border-brand-border/60 flex items-center justify-between text-xs text-brand-muted">
        <p className="text-[11px] leading-relaxed">
          Weekly allowances reset every Monday in Manila.
        </p>
        <button
          type="button"
          onClick={onOpenPlans}
          className="inline-flex items-center gap-1 font-bold text-brand-green hover:underline shrink-0 text-xs"
        >
          <span>View plans</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </section>
  );
}

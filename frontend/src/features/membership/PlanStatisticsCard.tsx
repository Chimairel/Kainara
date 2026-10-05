'use client';

import Card from '@/components/ui/Card';
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
        numColor: 'text-emerald-600 dark:text-emerald-400',
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
        numColor: 'text-[#eb6a38] dark:text-[#eb6a38]',
        barGradient: 'from-[#cf5626] to-[#eb6a38]',
        borderColor: 'border-orange-500/30',
      },
      {
        id: 'plan_review',
        name: 'Plan reviews',
        cadence: 'Target week',
        used: data.usage.PLAN_REVIEW.used,
        cap: data.usage.PLAN_REVIEW.cap,
        remaining: data.usage.PLAN_REVIEW.remaining,
        // Violet / Purple theme
        numColor: 'text-purple-600 dark:text-purple-400',
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
        numColor: 'text-lime-600 dark:text-lime-400',
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
    <Card
      decorationVariant="statistics"
      contentClassName="flex h-full flex-col justify-between"
      aria-label="Allowances and usage statistics"
      className="relative overflow-hidden rounded-[28px] sm:rounded-[36px] border border-[#dce4e0] dark:border-[#173e33] bg-[#faf8f5] dark:bg-[#071914] text-[#0d2820] dark:text-white shadow-xl p-6 sm:p-8 flex flex-col justify-between"
    >
      {/* Main Content inside Card */}
      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#dce4e0]/80 dark:border-[#173e33]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-[#dce4e0] dark:border-[#173e33] bg-white/80 dark:bg-[#0a201a] text-brand-green shadow-xs">
              <BarChart3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-base sm:text-lg font-black tracking-[-0.02em] text-[#0d2820] dark:text-white">
                Plan Statistics
              </h3>
              <p className="text-xs text-[#5a746a] dark:text-white/60">Usage tracking for your active cycle</p>
            </div>
          </div>
          <span className="rounded-full bg-white/80 dark:bg-[#0a201a] border border-[#dce4e0] dark:border-[#173e33] px-3 py-1 text-[10px] font-mono font-semibold text-[#5a746a] dark:text-emerald-200/80 shadow-xs">
            Resets {resetDate}
          </span>
        </div>

        <div className="pt-4 pb-1">
          <div className="grid grid-cols-4 gap-1.5 sm:gap-3 text-center">
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
            <div className="h-1.5 w-full rounded-full bg-[#dce4e0] dark:bg-[#173e33] shadow-[0_4px_8px_-1px_rgba(0,0,0,0.18)] dark:shadow-[0_4px_8px_-1px_rgba(0,0,0,0.5)]" />
          </div>

          <div className="grid grid-cols-4 gap-1.5 sm:gap-3 items-end pt-1">
            {stats.map((item) => {
              // Percentage calculation
              const rawPct = item.cap > 0 ? (item.used / item.cap) * 100 : 0;
              const fillHeightPct = Math.max(0, Math.min(100, rawPct));

              return (
                <div key={item.id} className="flex flex-col items-center group">
                  {/* The Capsule Pill Bar */}
                  <div
                    role="meter"
                    aria-label={`${item.name} used`}
                    aria-valuemin={0}
                    aria-valuemax={item.cap || 1}
                    aria-valuenow={Math.min(item.used, item.cap || 1)}
                    aria-valuetext={`${item.used} used, ${item.remaining} of ${item.cap} left`}
                    className="relative w-11 sm:w-13 md:w-15 h-44 sm:h-52 rounded-full overflow-hidden border border-[#dce4e0] dark:border-[#173e33] bg-white/70 dark:bg-[#091b15]/90 shadow-inner flex flex-col justify-end"
                    style={{
                      // Diagonal striped pattern for unfilled capacity
                      backgroundImage:
                        'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(120, 140, 130, 0.14) 5px, rgba(120, 140, 130, 0.14) 10px)',
                    }}
                  >
                    {/* Filled bar representing Usage (rising from bottom) */}
                    <div
                      className={`w-full bg-gradient-to-t ${item.barGradient} rounded-full transition-all duration-700 ease-out flex items-center justify-center relative shadow-sm`}
                      style={{
                        height: `${fillHeightPct}%`,
                      }}
                    />
                    <span
                      className={`absolute inset-x-0 bottom-1.5 text-center font-display font-semibold text-xs select-none ${fillHeightPct >= 15 ? 'text-white' : 'text-[#5a746a] dark:text-white/60'}`}
                    >
                      {item.used}
                    </span>
                  </div>

                  {/* Labels at bottom */}
                  <div className="mt-2.5 text-center w-full px-0.5">
                    <span
                      title={item.name}
                      className="block text-[10px] sm:text-xs font-semibold text-[#0d2820] dark:text-white text-center leading-tight min-h-[1.75rem] flex items-center justify-center"
                    >
                      {item.name}
                    </span>
                    <span className="block text-[9px] text-[#5a746a] dark:text-emerald-200/60 font-mono mt-0.5 uppercase tracking-wider">
                      {item.cadence}
                    </span>
                    {/* Remaining allowance */}
                    <span className="block text-[10px] text-[#5a746a] dark:text-white/60 mt-0.5 font-medium">
                      {item.remaining} of {item.cap} left
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer Info & View plans link */}
      <div className="relative z-10 mt-4 pt-3.5 border-t border-[#dce4e0]/80 dark:border-[#173e33] flex items-center justify-between text-xs text-[#5a746a] dark:text-white/60">
        <p className="text-[11px] leading-relaxed">Weekly allowances reset every Monday in Manila.</p>
        <button
          type="button"
          onClick={onOpenPlans}
          className="inline-flex items-center gap-1 font-bold text-brand-green hover:underline shrink-0 text-xs"
        >
          <span>View plans</span>
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </Card>
  );
}

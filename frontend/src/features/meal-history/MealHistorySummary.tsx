'use client';

import { MealMacros } from '@/components/user/MealMacros';

import { Check, ChevronDown, FileText, X } from 'lucide-react';

import type { useMealHistoryCardModel } from './useMealHistoryCardModel';
type Model = Extract<ReturnType<typeof useMealHistoryCardModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'setIsExpanded'
    | 'isExpanded'
    | 'foodPlate'
    | 'mealLabel'
    | 'log'
    | 'isSkipped'
    | 'isVoided'
    | 'isDone'
    | 'deltaVal'
  >;
};
export default function MealHistorySummary({ model }: SectionProps) {
  const { setIsExpanded, isExpanded, foodPlate, mealLabel, log, isSkipped, isVoided, isDone, deltaVal } = model;

  const hasDelta = deltaVal != null;
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
        className="flex w-full cursor-pointer items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-xl"
      >
        <div className="flex min-w-0 flex-1 items-center">
          {foodPlate}
          <div className="min-w-0 flex-1 pl-2.5 sm:pl-3.5">
            {/* Top Label & Source Badges */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/80">
                {mealLabel}
              </span>
              {log.source === 'SYSTEM_GENERATED' && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm border border-white/20">
                  KAINARA
                </span>
              )}
              {log.source === 'USER_LOGGED' && (
                <span className="rounded-full bg-amber-400/25 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-amber-200 backdrop-blur-sm border border-amber-300/30">
                  Outside Meal
                </span>
              )}
              {log.source === 'USER_SWAPPED' && (
                <span className="rounded-full bg-sky-400/25 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-sky-200 backdrop-blur-sm border border-sky-300/30">
                  Swapped
                </span>
              )}
            </div>

            {/* Meal Title */}
            <h4
              className={`mt-0.5 block font-display text-sm sm:text-base font-bold leading-snug text-white line-clamp-1 sm:line-clamp-2 ${
                isSkipped || isVoided ? 'line-through text-white/60' : ''
              }`}
            >
              {log.mealName}
            </h4>

            {/* Macro Line */}
            <MealMacros
              variant="line"
              calories={log.calories}
              proteinG={log.proteinG}
              carbsG={log.carbsG ?? 0}
              fatG={log.fatG ?? 0}
              className="mt-1"
            />

            {/* Subtext / Notes preview */}
            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] sm:text-[10.5px] text-white/80">
              {log.notes ? (
                <span className="flex items-center gap-1 font-medium text-amber-200">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[140px] sm:max-w-md italic">&ldquo;{log.notes}&rdquo;</span>
                </span>
              ) : (
                <span className="font-medium text-white/70 hover:underline">
                  {isDone ? 'Add notes' : 'View details'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side controls: Status badge at top, Details button at bottom */}
        <div className="ml-2 sm:ml-3 flex shrink-0 flex-col items-end justify-between gap-1.5 sm:gap-2.5 self-stretch py-0.5">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {hasDelta && log.source === 'USER_SWAPPED' && (
              <span
                className={`hidden sm:inline-block rounded-full px-2 py-0.5 font-mono text-[9px] font-bold border backdrop-blur-md ${
                  deltaVal > 0
                    ? 'border-amber-300/30 bg-amber-400/25 text-amber-100'
                    : 'border-white/30 bg-white/20 text-white'
                }`}
              >
                {deltaVal > 0 ? `+${Math.round(deltaVal)}` : Math.round(deltaVal)} kcal
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold tracking-wide backdrop-blur-md border shadow-xs ${
                isDone
                  ? 'border-emerald-300/40 bg-emerald-500/35 text-white'
                  : isSkipped
                    ? 'border-white/20 bg-black/30 text-white/80'
                    : isVoided
                      ? 'border-rose-400/30 bg-rose-900/40 text-rose-200'
                      : 'border-white/20 bg-black/25 text-white/90'
              }`}
            >
              {isDone ? (
                <>
                  <Check className="h-2.5 w-2.5 stroke-[3] text-emerald-300" />
                  <span>DONE</span>
                </>
              ) : isSkipped ? (
                <>
                  <X className="h-2.5 w-2.5 stroke-[3] text-white/70" />
                  <span>SKIPPED</span>
                </>
              ) : isVoided ? (
                <>
                  <X className="h-2.5 w-2.5 stroke-[3] text-rose-300" />
                  <span>VOIDED</span>
                </>
              ) : (
                <span>{log.status}</span>
              )}
            </span>
          </div>

          <span className="inline-flex min-h-7 sm:min-h-8 items-center gap-1 rounded-full bg-white/20 hover:bg-white/30 text-white px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] font-bold backdrop-blur-md border border-white/30 shadow-xs transition-all duration-200">
            <span>{isExpanded ? 'Hide' : 'Details'}</span>
            <ChevronDown
              className={`h-3 w-3 stroke-[2.5] transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </span>
        </div>
      </div>
    </>
  );
}

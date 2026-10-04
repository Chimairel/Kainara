'use client';

import { compactMealClasses, MealPlate, MealMacros } from '@/components/user/MealCardPresentation';
import { formatMealTitle } from '@/lib/meal-title';
import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import MealImage from '@/components/user/MealImage';
import type { MealPlan } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';

type Props =
  | { meal: PendingMealPreview; pending: true; index?: number; onOpen?: never; onStatusToggle?: never }
  | {
      meal: MealPlan;
      pending?: false;
      index?: number;
      onOpen: () => void;
      onStatusToggle?: (id: string, status: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void> | void;
    };

export { getMealTheme, THEMES } from '@/lib/compact-meal-theme';
import { getMealTheme } from '@/lib/compact-meal-theme';

export function DashboardMealRow(props: Props) {
  const { meal, index = 0 } = props;
  const [saving, setSaving] = useState(false);
  const completed = !props.pending && props.meal.mealLogs?.some((log) => log.status === 'DONE');
  const skipped = !props.pending && props.meal.mealLogs?.some((log) => log.status === 'SKIPPED');

  const theme = getMealTheme(meal.mealType, index);

  const foodPlate = (
    <MealPlate
      className={`relative -ml-9 sm:-ml-13 lg:-ml-16 h-28 w-28 sm:h-32 sm:w-32 lg:h-36 lg:w-36 shrink-0 rounded-full p-1.5 sm:p-2 bg-white dark:bg-[#12362c] shadow-[0_14px_32px_-4px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.7)] ${theme.plateRim} z-20 transition-transform duration-300 group-hover:scale-105`}
    >
      <MealImage
        mealName={meal.mealName}
        mealType={meal.mealType}
        ingredients={meal.ingredients}
        image={meal.image}
        variant="thumbnail"
        className="!rounded-full !border-0 h-full w-full object-cover"
      />
    </MealPlate>
  );

  if (props.pending) {
    return (
      <details className={`${compactMealClasses(meal.mealType, index)} p-4 sm:p-5`}>
        <summary className="flex cursor-pointer list-none items-center justify-between text-left [&::-webkit-details-marker]:hidden">
          <div className="flex min-w-0 flex-1 items-center">
            {foodPlate}
            <div className="min-w-0 flex-1 pl-3 sm:pl-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-white/80">
                {meal.mealType.toLowerCase()}
              </span>
              <span className="mt-0.5 block font-display text-base font-bold leading-snug text-white sm:text-lg line-clamp-2">
                {formatMealTitle(meal.mealName)}
              </span>
              {meal.ricePortion && (
                <span className="mt-1 block text-xs font-bold text-white">+ {meal.ricePortion}</span>
              )}
              <MealMacros
                variant="line"
                calories={meal.calories}
                proteinG={meal.proteinG}
                carbsG={meal.carbsG ?? 0}
                fatG={meal.fatG ?? 0}
                className="mt-1"
              />
            </div>
          </div>
          <div className="ml-3 flex shrink-0 flex-col items-end justify-between gap-3 self-stretch py-0.5">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold backdrop-blur-md border border-white/30 bg-black/25 text-white shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
              <span>Pending review</span>
            </span>
            <span className="inline-flex min-h-8 sm:min-h-9 items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 group-open:bg-white group-open:text-gray-900 text-white px-3 sm:px-3.5 py-1 text-xs font-bold backdrop-blur-md border border-white/30 shadow-xs transition-all duration-200">
              <span>Preview</span>
              <ChevronDown className="h-3.5 w-3.5 stroke-[2.5] group-open:rotate-180 transition-transform duration-200" />
            </span>
          </div>
        </summary>
        <div className="mt-3.5 pl-0 sm:pl-3">
          <div className="rounded-2xl bg-black/30 backdrop-blur-md p-4 text-sm leading-relaxed text-white border border-white/20 shadow-inner">
            <p className="font-bold text-white flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Pending nutritionist review
            </p>
            {meal.description && <p className="mt-1.5 text-xs text-white/90 leading-normal">{meal.description}</p>}
            <p className="mt-2 text-xs leading-normal">
              <strong className="text-white font-bold">Ingredients: </strong>
              <span className="text-white/85">
                {meal.ingredients?.map((item) => item.ingredientName).join(', ') || 'Ingredient preview unavailable.'}
              </span>
            </p>
          </div>
        </div>
      </details>
    );
  }

  const statusLabel = completed
    ? 'Eaten'
    : skipped
      ? 'Skipped'
      : props.meal.status === 'APPROVED'
        ? 'Approved'
        : 'Awaiting review';

  return (
    <article className={`${compactMealClasses(meal.mealType, index)} p-4 sm:p-5`}>
      <div className="flex w-full items-center">
        {/* Clickable details trigger: foodPlate and meal info */}
        <div className="flex min-w-0 flex-1 items-center">
          <button
            type="button"
            onClick={props.onOpen}
            aria-label={`Open ${formatMealTitle(meal.mealName)} details`}
            className="group/details flex min-w-0 flex-1 items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-xl"
          >
            {foodPlate}
            <div className="min-w-0 flex-1 pl-3 sm:pl-4">
              <span className="block text-xs font-bold uppercase tracking-wider text-white/80">
                {meal.mealType.toLowerCase()}
              </span>
              <span className="mt-0.5 block font-display text-base font-bold leading-snug text-white sm:text-lg group-hover/details:underline underline-offset-2 line-clamp-2">
                {formatMealTitle(meal.mealName)}
              </span>
              {meal.ricePortion && (
                <span className="mt-1 block text-xs font-bold text-white">+ {meal.ricePortion}</span>
              )}
              <MealMacros
                variant="line"
                calories={meal.calories}
                proteinG={meal.proteinG}
                carbsG={meal.carbsG ?? 0}
                fatG={meal.fatG ?? 0}
                className="mt-1"
              />
            </div>
          </button>
        </div>

        {/* Right side controls: Status badge at top, Enhanced Action button at bottom */}
        <div className="ml-3 flex shrink-0 flex-col items-end justify-between gap-3 self-stretch py-0.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide backdrop-blur-md border shadow-xs ${
              completed
                ? 'border-emerald-300/40 bg-emerald-500/35 text-white'
                : skipped
                  ? 'border-white/20 bg-black/30 text-white/80'
                  : props.meal.status === 'APPROVED'
                    ? 'border-white/30 bg-white/20 text-white'
                    : 'border-white/20 bg-black/25 text-white/90'
            }`}
          >
            {completed ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span>{statusLabel}</span>
              </>
            ) : skipped ? (
              <span>{statusLabel}</span>
            ) : props.meal.status === 'APPROVED' ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                <span>{statusLabel}</span>
              </>
            ) : (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-300 animate-pulse" />
                <span>{statusLabel}</span>
              </>
            )}
          </span>

          {props.onStatusToggle && props.meal.status === 'APPROVED' && (
            <button
              type="button"
              disabled={saving}
              aria-label={`Mark ${formatMealTitle(meal.mealName)} as ${completed ? 'not eaten' : 'eaten'}`}
              onClick={async () => {
                setSaving(true);
                try {
                  await props.onStatusToggle?.(props.meal.id, completed ? 'PENDING' : 'DONE');
                } finally {
                  setSaving(false);
                }
              }}
              className={`inline-flex min-h-8 sm:min-h-9 items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-bold shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 ${
                completed
                  ? 'bg-emerald-400 text-emerald-950 shadow-emerald-900/20 hover:bg-emerald-300'
                  : 'bg-white text-gray-900 shadow-black/15 hover:bg-white/95 hover:shadow-lg'
              }`}
            >
              <Check className={`h-3.5 w-3.5 stroke-[3] ${completed ? 'text-emerald-950' : 'text-emerald-600'}`} />
              <span>{saving ? 'Saving…' : completed ? 'Undo eaten' : 'Mark as eaten'}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

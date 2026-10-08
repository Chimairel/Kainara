'use client';

import { DashboardMealCardSurface, DashboardMealPlate } from '@/components/user/DashboardMealCardSurface';
import { MealMacros } from '@/components/user/MealMacros';
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

  const statusLabel = props.pending
    ? 'Pending review'
    : completed
      ? 'Eaten'
      : skipped
        ? 'Skipped'
        : props.meal.status === 'APPROVED'
          ? 'Approved'
          : 'Awaiting review';

  const statusBadge = (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide backdrop-blur-md border shadow-xs ${
        completed
          ? 'border-emerald-300/40 bg-emerald-500/35 text-white'
          : skipped
            ? 'border-white/20 bg-black/30 text-white/80'
            : !props.pending && props.meal.status === 'APPROVED'
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
      ) : !props.pending && props.meal.status === 'APPROVED' ? (
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
  );
  const mobileHeader = (
    <div className="mb-3 flex w-full items-center justify-between gap-2 sm:hidden">
      <span className="text-[11px] font-bold uppercase tracking-wider text-white/80">
        {meal.mealType.toLowerCase()}
      </span>
    </div>
  );

  const foodPlate = (
    <DashboardMealPlate
      className={`relative -ml-7 sm:-ml-13 lg:-ml-16 h-24 w-24 sm:h-32 sm:w-32 lg:h-36 lg:w-36 shrink-0 rounded-full p-1.5 sm:p-2 bg-white dark:bg-[#12362c] shadow-[0_14px_32px_-4px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.7)] ${theme.plateRim} z-20 transition-transform duration-300 group-hover:scale-105`}
    >
      <MealImage
        mealName={meal.mealName}
        mealType={meal.mealType}
        ingredients={meal.ingredients}
        image={meal.image}
        variant="thumbnail"
        className="!rounded-full !border-0 h-full w-full object-cover"
      />
    </DashboardMealPlate>
  );

  if (props.pending) {
    return (
      <DashboardMealCardSurface as="details" mealType={meal.mealType} index={index} className="p-4 sm:p-5">
        <summary className="flex flex-col gap-3 cursor-pointer list-none items-stretch sm:flex-row sm:items-center sm:justify-between sm:gap-0 text-left [&::-webkit-details-marker]:hidden">
          {mobileHeader}
          <div className="flex w-full min-w-0 flex-1 items-center sm:w-auto">
            {foodPlate}
            <div className="min-w-0 flex-1 pl-3 sm:pl-4">
              <span className="hidden text-xs font-bold uppercase tracking-wider text-white/80 sm:block">
                {meal.mealType.toLowerCase()}
              </span>
              <span className="mt-0.5 block font-display text-base font-bold leading-snug text-white sm:text-lg sm:line-clamp-2">
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
          <div className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-white/20 pt-3 pb-0.5 sm:ml-3 sm:w-auto sm:flex-col sm:items-end sm:self-stretch sm:border-0 sm:py-0.5">
            <div className="absolute right-4 top-4 sm:static">{statusBadge}</div>
            <span className="inline-flex w-full justify-center sm:w-auto min-h-11 sm:min-h-9 items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 group-open:bg-white group-open:text-gray-900 text-white px-3 sm:px-3.5 py-1 text-xs font-bold backdrop-blur-md border border-white/30 shadow-xs transition-all duration-200">
              <span>Preview</span>
              <ChevronDown className="h-3.5 w-3.5 stroke-[2.5] group-open:rotate-180 transition-transform duration-200" />
            </span>
          </div>
        </summary>
        <div className="mt-3.5 pl-0 sm:pl-3">
          <div className="rounded-2xl bg-black/30 backdrop-blur-md p-4 text-sm leading-relaxed text-white border border-white/20 shadow-inner">
            <p className="font-bold text-white flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              Pending RND review
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
      </DashboardMealCardSurface>
    );
  }

  return (
    <DashboardMealCardSurface mealType={meal.mealType} index={index} className="p-4 sm:p-5">
      {mobileHeader}
      <div className="flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-0">
        {/* Clickable details trigger: foodPlate and meal info */}
        <div className="flex w-full min-w-0 flex-1 items-center sm:w-auto">
          <button
            type="button"
            onClick={props.onOpen}
            aria-label={`Open ${formatMealTitle(meal.mealName)} details`}
            className="group/details flex min-w-0 flex-1 items-center text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-xl"
          >
            {foodPlate}
            <div className="min-w-0 flex-1 pl-3 sm:pl-4">
              <span className="hidden text-xs font-bold uppercase tracking-wider text-white/80 sm:block">
                {meal.mealType.toLowerCase()}
              </span>
              <span className="mt-0.5 block font-display text-base font-bold leading-snug text-white sm:text-lg group-hover/details:underline underline-offset-2 sm:line-clamp-2">
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

        {/* Mobile footer below the meal text; desktop controls stay beside it. */}
        <div className="flex w-full shrink-0 items-center justify-between gap-3 border-t border-white/20 pt-3 pb-0.5 sm:ml-3 sm:w-auto sm:flex-col sm:items-end sm:self-stretch sm:border-0 sm:py-0.5">
          <div className="absolute right-4 top-4 sm:static">{statusBadge}</div>

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
              className={`inline-flex w-full justify-center sm:w-auto min-h-11 sm:min-h-9 items-center gap-1.5 rounded-full px-3.5 sm:px-4 py-1.5 text-xs font-bold shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 ${
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
    </DashboardMealCardSurface>
  );
}

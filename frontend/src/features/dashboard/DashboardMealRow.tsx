'use client';

import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import MealImage from '@/components/user/MealImage';
import type { MealPlan } from '@/types';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';

type Props =
  | { meal: PendingMealPreview; pending: true; onOpen?: never; onStatusToggle?: never }
  | {
      meal: MealPlan;
      pending?: false;
      onOpen: () => void;
      onStatusToggle?: (id: string, status: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void> | void;
    };

export function DashboardMealRow(props: Props) {
  const { meal } = props;
  const [saving, setSaving] = useState(false);
  const completed = !props.pending && props.meal.mealLogs?.some((log) => log.status === 'DONE');
  const skipped = !props.pending && props.meal.mealLogs?.some((log) => log.status === 'SKIPPED');

  const foodPlate = (
    <div className="relative -ml-9 sm:-ml-13 lg:-ml-16 h-28 w-28 sm:h-32 sm:w-32 lg:h-36 lg:w-36 shrink-0 rounded-full p-1.5 sm:p-2 bg-white dark:bg-[#12362c] shadow-[0_14px_32px_-4px_rgba(0,0,0,0.22),0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.7)] border-2 border-[#e2e8e5] dark:border-[#1a4e40] z-20 transition-transform duration-300 group-hover:scale-105">
      <div className="relative h-full w-full rounded-full overflow-hidden">
        <MealImage
          mealName={meal.mealName}
          mealType={meal.mealType}
          ingredients={meal.ingredients}
          image={props.pending ? undefined : props.meal.image}
          variant="thumbnail"
          hideRepresentativeBadge
          className="!rounded-full !border-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );

  const mealInfo = (
    <div className="min-w-0 flex-1 pl-3 sm:pl-4">
      <span className="block text-xs font-bold uppercase tracking-wider text-brand-green">
        {meal.mealType.toLowerCase()}
      </span>
      <span className="mt-0.5 block font-display text-base font-bold leading-snug text-brand-text sm:text-lg">
        {meal.mealName}
      </span>
      <span className="mt-1 block text-xs font-medium text-brand-muted">
        <strong className="text-brand-text font-bold">{Math.round(meal.calories)}</strong> kcal · <strong className="text-brand-text font-bold">{Math.round(meal.proteinG)}g</strong> protein
      </span>
      {props.pending && (
        <span className="mt-1 block text-xs font-semibold text-status-pending-text">Pending review · View preview</span>
      )}
    </div>
  );

  if (props.pending)
    return (
      <details className="dashboard-meal group relative p-4 sm:p-5">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-left [&::-webkit-details-marker]:hidden">
          {foodPlate}
          {mealInfo}
          <ChevronDown className="h-4 w-4 shrink-0 text-brand-muted group-open:rotate-180 transition-transform duration-200 mr-1" />
        </summary>
        <div className="mt-3.5 pl-0 sm:pl-3">
          <div className="rounded-xl bg-brand-bgAlt p-4 text-sm leading-relaxed text-brand-muted border border-brand-border/40">
            <p className="font-semibold text-status-pending-text">Pending nutritionist review</p>
            {meal.description && <p className="mt-2">{meal.description}</p>}
            <p className="mt-2">
              <strong className="text-brand-text">Ingredients: </strong>
              {meal.ingredients?.map((item) => item.ingredientName).join(', ') || 'Ingredient preview unavailable.'}
            </p>
          </div>
        </div>
      </details>
    );

  return (
    <article className="dashboard-meal group relative p-4 sm:p-5">
      <button
        type="button"
        onClick={props.onOpen}
        aria-label={`Open ${meal.mealName} details`}
        className="flex w-full items-center text-left"
      >
        {foodPlate}
        {mealInfo}
      </button>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 pl-0 sm:pl-3 border-t border-brand-border/40 dark:border-[#173e33]/50 pt-2.5">
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${props.meal.status === 'APPROVED' ? 'bg-brand-greenLight text-brand-green' : 'border border-[#a64600]/30 bg-[#8c3b00] text-white shadow-xs'}`}
        >
          {completed
            ? 'Eaten'
            : skipped
              ? 'Skipped'
              : props.meal.status === 'APPROVED'
                ? 'Approved'
                : 'Awaiting review'}
        </span>
        {props.onStatusToggle && props.meal.status === 'APPROVED' && (
          <button
            type="button"
            disabled={saving}
            aria-label={`Mark ${meal.mealName} as ${completed ? 'not eaten' : 'eaten'}`}
            onClick={async () => {
              setSaving(true);
              try {
                await props.onStatusToggle?.(props.meal.id, completed ? 'PENDING' : 'DONE');
              } finally {
                setSaving(false);
              }
            }}
            className="dashboard-action inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold disabled:opacity-50 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Check className="h-3.5 w-3.5 stroke-[2.5]" />
            {saving ? 'Saving…' : completed ? 'Undo eaten' : 'Mark as eaten'}
          </button>
        )}
      </div>
    </article>
  );
}

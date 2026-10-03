'use client';

import { formatMealTitle } from '@/lib/meal-title';
import React, { useState } from 'react';
import { Check, Clock3, Loader2, X } from 'lucide-react';
import type { MealPlan } from '@/types';
import MealImage from '@/components/user/MealImage';
import { getMealTheme } from '@/features/dashboard/DashboardMealRow';

interface UnloggedMealCatchUpCardProps {
  meal: MealPlan;
  onStatusToggle: (mealPlanId: string, status: 'DONE' | 'SKIPPED') => Promise<void>;
  className?: string;
}

export default function UnloggedMealCatchUpCard({
  meal,
  onStatusToggle,
  className = '',
}: UnloggedMealCatchUpCardProps) {
  const [isUpdating, setIsUpdating] = useState<'DONE' | 'SKIPPED' | null>(null);

  const normalizedType = (meal.mealType || '').toUpperCase();
  const mealType = normalizedType.includes('BREAKFAST')
    ? 'BREAKFAST'
    : normalizedType.includes('DINNER')
      ? 'DINNER'
      : normalizedType.includes('SNACK')
        ? 'SNACK'
        : 'LUNCH';

  const mealLabels: Record<string, string> = {
    BREAKFAST: 'Breakfast',
    LUNCH: 'Lunch',
    DINNER: 'Dinner',
    SNACK: 'Snack',
  };
  const mealLabel = mealLabels[mealType] || 'Meal';

  const theme = getMealTheme(mealType);

  const handleAction = async (status: 'DONE' | 'SKIPPED') => {
    if (isUpdating) return;
    setIsUpdating(status);
    try {
      await onStatusToggle(meal.id, status);
    } catch (err) {
      console.error('[UnloggedMealCatchUpCard] Failed to toggle status:', err);
    } finally {
      setIsUpdating(null);
    }
  };

  const foodPlate = (
    <div
      className={`relative -ml-4 sm:-ml-6 md:-ml-7 h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 shrink-0 rounded-full p-1 sm:p-1.5 bg-white dark:bg-[#12362c] shadow-[0_8px_20px_-3px_rgba(0,0,0,0.22),0_2px_6px_rgba(0,0,0,0.08)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.65)] ${theme.plateRim} z-20 transition-transform duration-300 group-hover:scale-105`}
    >
      <div className="relative h-full w-full rounded-full overflow-hidden">
        <MealImage
          image={meal.image}
          mealName={meal.mealName}
          mealType={meal.mealType}
          variant="thumbnail"
          hideRepresentativeBadge
          className="!rounded-full !border-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );

  return (
    <article
      className={`dashboard-meal group relative overflow-visible p-3 sm:py-3.5 sm:px-4.5 ${theme.cardBg} ${theme.borderColor} ${theme.shadow} ${theme.hoverShadow} ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-left">
        {/* Left: Food plate + info */}
        <div className="flex min-w-0 flex-1 items-center">
          {foodPlate}
          <div className="min-w-0 flex-1 pl-2.5 sm:pl-3.5">
            {/* Category and Unlogged Badge */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-white/80">
                {mealLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/25 backdrop-blur-sm px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-amber-200 border border-amber-300/30">
                <Clock3 className="h-2.5 w-2.5" />
                <span>Unlogged</span>
              </span>
            </div>

            {/* Meal Title */}
            <h4 className="mt-0.5 block font-display text-sm sm:text-base font-bold leading-snug text-white line-clamp-1 sm:line-clamp-2">
              {formatMealTitle(meal.mealName)}
            </h4>

            {/* Macros */}
            <span className="mt-0.5 block text-[10.5px] sm:text-xs font-medium text-white/90">
              <span className="font-bold text-white">{Math.round(meal.calories)} kcal</span>
              <span className="mx-1 sm:mx-1.5">·</span>
              <span className="font-bold text-white">{Math.round(meal.proteinG)}g P</span>
              <span className="mx-1 sm:mx-1.5">·</span>
              <span className="font-bold text-white">{Math.round(meal.carbsG)}g C</span>
              <span className="mx-1 sm:mx-1.5">·</span>
              <span className="font-bold text-white">{Math.round(meal.fatG)}g F</span>
            </span>
          </div>
        </div>

        {/* Action Buttons: on mobile, full breathing room below; on sm+, aligned on the right */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end sm:ml-3 pl-10 sm:pl-0">
          <button
            type="button"
            onClick={() => handleAction('DONE')}
            disabled={isUpdating !== null}
            aria-label="Mark as Eaten"
            className="flex-1 sm:flex-initial inline-flex h-8 sm:h-8.5 items-center justify-center gap-1.5 rounded-full bg-white hover:bg-white/95 text-gray-900 px-3.5 text-xs font-bold shadow-md transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
          >
            {isUpdating === 'DONE' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-900" />
            ) : (
              <Check className="h-3.5 w-3.5 stroke-[3] text-emerald-600" />
            )}
            <span>Mark as Eaten</span>
          </button>

          <button
            type="button"
            onClick={() => handleAction('SKIPPED')}
            disabled={isUpdating !== null}
            aria-label="Skip"
            className="flex-initial inline-flex h-8 sm:h-8.5 items-center justify-center gap-1 rounded-full bg-black/25 hover:bg-black/35 text-white/90 hover:text-white px-3 text-xs font-bold backdrop-blur-md border border-white/25 shadow-xs transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
          >
            {isUpdating === 'SKIPPED' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
            ) : (
              <X className="h-3.5 w-3.5 stroke-[2.5] text-white/80" />
            )}
            <span>Skip</span>
          </button>
        </div>
      </div>
    </article>
  );
}

'use client';

import type { RefObject } from 'react';
import { DashboardMealCardSurface, DashboardMealPlate } from '@/components/user/DashboardMealCardSurface';
import { MealMacros } from '@/components/user/MealMacros';
import MealImage from '@/components/user/MealImage';
import { getMealTheme } from '@/lib/compact-meal-theme';
import { formatMealTitle } from '@/lib/meal-title';
import Button from '@/components/ui/Button';
import { ShieldAlert } from '@/components/ui/icons';
import type { LibraryMeal } from '../useNutritionistLibrary';

/** Detail header combines the dashboard surface with the library's cropped photo. */
export default function LibraryMealHeader({ meal, onFlag, flagTrigger }: { meal: LibraryMeal; onFlag: () => void; flagTrigger: RefObject<HTMLDivElement | null> }) {
  const theme = getMealTheme(meal.mealType);
  const held = meal.status === 'FLAGGED';
  const label = held ? meal.reviewLineage?.state === 'QUARANTINED' ? 'Quarantined' : 'Pending re-review' : meal.baseVerification === 'VERIFIED' ? 'Verified' : 'Review pending';
  return <DashboardMealCardSurface mealType={meal.mealType} className="!overflow-hidden">
    <header aria-label="Meal summary" className="relative grid lg:min-h-64 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="relative h-52 overflow-hidden sm:h-60 lg:h-full lg:min-h-64">
        <DashboardMealPlate className={`!absolute -left-8 top-1/2 h-64 w-64 -translate-y-1/2 p-1.5 sm:-left-12 sm:h-80 sm:w-80 lg:-left-16 sm:p-2 ${theme.plateRim}`}>
          <MealImage image={meal.image ?? null} mealName={meal.mealName} mealType={meal.mealType} variant="thumbnail" hideRepresentativeBadge className="h-full w-full !rounded-full !border-0" />
        </DashboardMealPlate>
      </div>
      <div className="flex min-w-0 flex-col justify-center p-5 sm:p-7 lg:pl-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-bold uppercase tracking-wide text-white/90">{meal.mealType}</span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1.5 text-sm font-semibold text-white">
            <span className={`h-1.5 w-1.5 rounded-full ${held || meal.baseVerification !== 'VERIFIED' ? 'bg-amber-300' : 'bg-emerald-300'}`} aria-hidden="true" />{label}
          </span>
        </div>
        <h1 className="mt-3 break-words font-display text-3xl font-bold leading-tight text-white sm:text-4xl">{formatMealTitle(meal.mealName)}</h1>
        <MealMacros variant="line" calories={meal.calories} proteinG={meal.proteinG} carbsG={meal.carbsG} fatG={meal.fatG} className="mt-3 gap-x-2 gap-y-1 text-sm sm:text-base" />
        <div ref={flagTrigger} className="mt-5 flex justify-end">
          <Button variant="danger" size="sm" disabled={meal.status === 'ARCHIVED'} onClick={onFlag}>
            <ShieldAlert className="h-4 w-4" aria-hidden="true" /> Flag meal
          </Button>
        </div>
      </div>
    </header>
  </DashboardMealCardSurface>;
}

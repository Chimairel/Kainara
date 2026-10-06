'use client';
import { Suspense } from 'react';
import MealPlanSkeleton from '@/features/meals/MealPlanSkeleton';
import MealsWorkspace from '@/features/meals/MealsWorkspace';
export default function WeeklyPlanPage() {
  return (
    <Suspense fallback={<MealPlanSkeleton />}>
      <MealsWorkspace />
    </Suspense>
  );
}

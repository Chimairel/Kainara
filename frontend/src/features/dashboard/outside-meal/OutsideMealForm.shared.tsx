import { type RiceReference } from '@/lib/rice-accompaniment';
import type { MealType } from '@/types';

export interface Suggestion {
  kind: string;
  id: string;
  name: string;
  label: string;
  serving?: string;
  macros?: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  ricePairing?: 'ULAM' | 'RICE_INCLUDED' | 'STANDALONE';
  riceReference?: RiceReference;
}
export const mealLabels: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
};

import type { SwapNutritionValues } from '@/features/meals/SwapNutritionTable';
export type ReviewNutritionTargets = {
  meal: Pick<SwapNutritionValues, 'calories' | 'proteinG' | 'carbsG' | 'fatG'> | null;
  daily: (Pick<SwapNutritionValues, 'calories' | 'proteinG' | 'carbsG' | 'fatG'> & { explanation: string; basis: string }) | null;
  rules: Array<{
    nutrient: keyof SwapNutritionValues; value: number; operator: string; unit: string;
    basis: 'MEAL' | 'DAY'; condition: string; sourceTitle: string; sourceUrl: string;
  }>;
  guidance?: Array<{ nutrient: string; value: string; explanation: string; sourceTitle: string; sourceUrl: string }>;
};

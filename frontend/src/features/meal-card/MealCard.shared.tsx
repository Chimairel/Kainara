import {
  AIConfidenceFlag,
  MealCookingLink,
  MealExplanation,
  MealPlanStatus,
  MealType,
  PublicMealImage,
  PublicVerifier,
} from '@/types';

export interface Ingredient {
  id: string;
  ingredientName: string;
  category?: string;
}
export interface MealLog {
  id: string;
  status: 'DONE' | 'SKIPPED' | 'PENDING';
  source?: string;
}
export interface MealCardProps {
  id: string;
  mealName: string;
  mealType: MealType;
  description?: string;
  ricePortion?: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  status: MealPlanStatus;
  aiConfidenceFlag: AIConfidenceFlag;
  ingredients?: Ingredient[];
  mealLogs?: MealLog[];
  onStatusToggle?: (mealId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void>;
  onSwapClick?: (mealId: string) => void;
  scheduledDate?: string;
  cycleScope?: 'CURRENT' | 'UPCOMING';
  onCardClick?: () => void;
  verifier?: PublicVerifier | null;
  explanation?: MealExplanation;
  image?: PublicMealImage | null;
  cookingLink?: MealCookingLink | null;
  nutritionistNote?: string | null;
  reviewedAt?: string | Date | null;
  index?: number;
  defaultOpen?: boolean;
  onCloseModal?: () => void;
}

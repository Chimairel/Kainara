import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';

export interface MealHistoryCardProps {
  log: MealHistoryLog;
  onUpdateNotes?: (logId: string, notes: string | null) => Promise<void>;
  onEditOutsideItem?: (
    logId: string,
    itemId: string,
    input: {
      name: string;
      portionGrams: number | null;
      reportedNutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number };
      unresolved?: boolean;
      reason: string;
    }
  ) => Promise<void>;
  onVoidOutsideLog?: (logId: string, reason: string) => Promise<void>;
  onRequestOutsideReview?: (logId: string, itemId: string) => Promise<void>;
  onReplyToOutsideReview?: (logId: string, itemId: string, message: string) => Promise<void>;
  onObservedConsent?: (logId: string, itemId: string, imageReuseConsent: boolean) => Promise<void>;
  onObservedWithdraw?: (submissionId: string) => Promise<void>;
  className?: string;
}

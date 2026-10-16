import type { MealType } from '@/types';
import type { OutsideMealInputItem, OutsideMealWarning } from './model';

export type SubmitOptions = {
  useAiEstimate: boolean;
  items: OutsideMealInputItem[];
  consumedAt?: string;
  estimationContext?: string;
  imageFile?: File | null;
};

export type OutsideMealModalProps = {
  savedFood?: { logId: string; itemId: string | null } | null;
  feedbackBusy?: boolean;
  feedbackError?: string | null;
  onDismissFeedback?: () => void;
  onRequestFeedback?: () => void;
  isLoading: boolean;
  isOpen: boolean;
  mealName: string;
  mealType: MealType;
  notes: string;
  onClose: () => void;
  onMealNameChange: (value: string) => void;
  onMealTypeChange: (value: MealType) => void;
  onNotesChange: (value: string) => void;
  onSubmit: (acknowledgePreview: boolean, options?: SubmitOptions) => void;
  onWarningCancel: () => void;
  warning: OutsideMealWarning | null;
};

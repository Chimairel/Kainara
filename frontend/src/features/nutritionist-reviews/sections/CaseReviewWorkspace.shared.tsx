import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';

import type { Dispatch, ReactNode, SetStateAction } from 'react';

export type Props = {
  review: ReturnType<typeof useNutritionistReviews>;
  caseFilter: string;
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  navigation: ReactNode;
  caseFilters: ReactNode;
};

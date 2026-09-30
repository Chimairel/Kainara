import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealLibraryPage from '@/app/(nutritionist)/nutritionist/library/page';

const coverage = {
  sourceRecipesWithCoreNutrition: 1960,
  certifiedMeals: 51,
  requiredPerSlot: 7,
  profiles: [{
    key: 'DIABETES',
    label: 'Diabetes',
    counts: { BREAKFAST: 0, LUNCH: 0, DINNER: 0 },
    caseReviewCounts: { BREAKFAST: 15, LUNCH: 18, DINNER: 18 },
    total: 0,
    caseReviewTotal: 51,
    minimumPerSlot: 0,
    caseReviewMinimumPerSlot: 15,
    weekReady: false,
    servingCoverage: [{
      dailyCalorieTarget: 1800,
      counts: { BREAKFAST: 0, LUNCH: 0, DINNER: 0 },
      caseReviewCounts: { BREAKFAST: 2, LUNCH: 3, DINNER: 4 },
      weekReady: false,
    }],
  }],
  combinationColumns: [],
  combinationMatrix: [],
  structuredProfiles: [],
};

vi.mock('@/features/nutritionist-library/useNutritionistLibrary', () => ({
  AVAILABLE_CONDITIONS: [],
  useNutritionistLibrary: () => ({
    meals: [], totalCount: 0, page: 1, setPage: vi.fn(), totalPages: 1,
    isLoading: false, fetchError: null, coverage,
    searchVal: '', setSearchVal: vi.fn(), mealType: 'All', setMealType: vi.fn(),
    conditionTag: 'All', setConditionTag: vi.fn(),
    verifiedByMe: false, setVerifiedByMe: vi.fn(),
    adminDraftsOnly: false, setAdminDraftsOnly: vi.fn(),
    status: 'ALL', setStatus: vi.fn(), fetchLibrary: vi.fn(),
  }),
}));

describe('nutritionist recipe coverage', () => {
  it('separates source data, automatic reuse, and case-review candidates', () => {
    render(<MealLibraryPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Recipe coverage' }));

    const panel = screen.getByRole('region', { name: 'Recipe availability and review readiness' });
    expect(within(panel).getByText(/1960 Panlasang sources with core numbers/)).toBeInTheDocument();
    expect(within(panel).getByText(/51 certified library servings/)).toBeInTheDocument();
    expect(within(panel).getByText('Auto reuse: 0 lowest slot')).toBeInTheDocument();
    expect(within(panel).getByText('Can enter case review · B / L / D')).toBeInTheDocument();
    expect(within(panel).getByText('15')).toBeInTheDocument();
    expect(within(panel).queryByText('Coverage gap')).not.toBeInTheDocument();
    fireEvent.click(within(panel).getByText('Serving fit by daily target'));
    expect(within(panel).getByText('Case review: B 2 · L 3 · D 4')).toBeInTheDocument();
  });
});

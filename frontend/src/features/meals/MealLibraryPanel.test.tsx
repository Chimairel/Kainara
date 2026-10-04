import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealLibraryPanel from './MealLibraryPanel';
import type { useMealsWorkspace } from './useMealsWorkspace';

vi.mock('@/components/user/MealImage', () => ({
  default: ({ mealName }: { mealName: string }) => <div aria-label={`Image of ${mealName}`} />,
}));

const noOp = vi.fn();

describe('Meal Library', () => {
  it('shows owner-scoped plan approvals without calling them reusable certified recipes', () => {
    const workspace = {
      handleLibrarySearchSubmit: noOp,
      librarySearch: '',
      setLibrarySearch: noOp,
      libraryMealType: 'All',
      setLibraryMealType: noOp,
      isLibraryLoading: false,
      libraryError: null,
      libraryMeals: [],
      setSelectedVerifier: noOp,
      libraryRiceRole: 'All',
      setLibraryRiceRole: noOp,
      libraryNextCursor: null,
      loadMoreLibrary: noOp,
      libraryTotalCount: 0,
      meals: [
        {
          id: 'approved-plan-meal',
          status: 'APPROVED',
          mealName: 'Corned Beef Sinigang',
          mealType: 'DINNER',
          calories: 771,
          proteinG: 54,
          carbsG: 32,
          fatG: 48,
          libraryMealId: null,
        },
      ],
    } as unknown as ReturnType<typeof useMealsWorkspace>;

    render(<MealLibraryPanel workspace={workspace} />);

    expect(screen.getByText('Corned Beef Sinigang')).toBeInTheDocument();
    expect(screen.getByText('Scheduled for you')).toBeInTheDocument();
    expect(screen.getByText('In your plan')).toBeInTheDocument();
    expect(screen.queryByText('No Recipes Found')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View planned meal' })).toHaveAttribute(
      'href',
      '/dashboard/approved-plan-meal'
    );
  });

  it('shows repeated approved plan slots as one recipe with links to both dates', () => {
    const first = {
      id: 'current-slot',
      status: 'APPROVED',
      mealName: 'Chicken Adobo Fried Rice',
      mealType: 'BREAKFAST',
      calories: 721,
      proteinG: 17,
      carbsG: 62,
      fatG: 45,
      baseRecipeSignature: 'same-recipe',
      composedServingSignature: 'same-serving',
      libraryMealId: null,
      cycleScope: 'CURRENT',
      scheduledDate: '2026-09-25T00:00:00.000Z',
    };
    const workspace = {
      handleLibrarySearchSubmit: noOp,
      librarySearch: '',
      setLibrarySearch: noOp,
      libraryMealType: 'All',
      setLibraryMealType: noOp,
      isLibraryLoading: false,
      libraryError: null,
      libraryMeals: [],
      setSelectedVerifier: noOp,
      libraryRiceRole: 'All',
      setLibraryRiceRole: noOp,
      libraryNextCursor: null,
      loadMoreLibrary: noOp,
      libraryTotalCount: 0,
      meals: [
        first,
        { ...first, id: 'upcoming-slot', cycleScope: 'UPCOMING', scheduledDate: '2026-10-02T00:00:00.000Z' },
      ],
    } as unknown as ReturnType<typeof useMealsWorkspace>;

    render(<MealLibraryPanel workspace={workspace} />);

    expect(screen.getAllByText('Chicken Adobo Fried Rice')).toHaveLength(1);
    expect(screen.getByText('In your plan · 2 times')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'This week · Sep 25' })).toHaveAttribute('href', '/dashboard/current-slot');
    expect(screen.queryByText(/reusable approvals/)).not.toBeInTheDocument();
  });

  it('paginates planned meals 6 at a time with previous and next navigation', () => {
    const plannedMeals = Array.from({ length: 9 }, (_, i) => ({
      id: `meal-${i + 1}`,
      status: 'APPROVED',
      mealName: `Planned Meal ${i + 1}`,
      mealType: 'LUNCH',
      calories: 500,
      proteinG: 30,
      carbsG: 40,
      fatG: 15,
      libraryMealId: null,
      cycleScope: 'CURRENT',
      scheduledDate: '2026-09-25T00:00:00.000Z',
    }));
    const workspace = {
      handleLibrarySearchSubmit: noOp,
      librarySearch: '',
      setLibrarySearch: noOp,
      libraryMealType: 'All',
      setLibraryMealType: noOp,
      isLibraryLoading: false,
      libraryError: null,
      libraryMeals: [],
      setSelectedVerifier: noOp,
      libraryRiceRole: 'All',
      setLibraryRiceRole: noOp,
      libraryNextCursor: null,
      loadMoreLibrary: noOp,
      libraryTotalCount: 0,
      meals: plannedMeals,
    } as unknown as ReturnType<typeof useMealsWorkspace>;

    const { getByText, queryByText, getByRole } = render(<MealLibraryPanel workspace={workspace} />);

    // Page 1 displays first 6 meals
    expect(getByText('Planned Meal 1')).toBeInTheDocument();
    expect(getByText('Planned Meal 6')).toBeInTheDocument();
    expect(queryByText('Planned Meal 7')).not.toBeInTheDocument();
    expect(getByText('Page 1 of 2')).toBeInTheDocument();

    // Navigate to Page 2
    const nextBtn = getByRole('button', { name: 'Next' });
    fireEvent.click(nextBtn);
    expect(getByText('Page 2 of 2')).toBeInTheDocument();
    expect(getByText('Planned Meal 7')).toBeInTheDocument();
    expect(getByText('Planned Meal 9')).toBeInTheDocument();
    expect(queryByText('Planned Meal 1')).not.toBeInTheDocument();
  });

  it('labels profile-matched approvals without presenting them as broad certification', () => {
    const workspace = {
      handleLibrarySearchSubmit: noOp,
      librarySearch: '',
      setLibrarySearch: noOp,
      libraryMealType: 'All',
      setLibraryMealType: noOp,
      isLibraryLoading: false,
      libraryError: null,
      setSelectedVerifier: noOp,
      libraryRiceRole: 'All',
      setLibraryRiceRole: noOp,
      libraryNextCursor: null,
      loadMoreLibrary: noOp,
      libraryTotalCount: 1,
      meals: [],
      libraryMeals: [
        {
          id: 'shared-recipe',
          mealName: 'Vegetable Rice',
          mealType: 'LUNCH',
          mealTypes: ['LUNCH'],
          calories: 400,
          proteinG: 12,
          carbsG: 70,
          fatG: 8,
          verifiedBy: 'Dietitian',
          prcLicenseNumber: '123',
          reuseBasis: 'PROFILE_MATCHED_APPROVAL',
        },
      ],
    } as unknown as ReturnType<typeof useMealsWorkspace>;
    render(<MealLibraryPanel workspace={workspace} />);
    expect(screen.getByText('Reviewed for a matching health profile')).toBeInTheDocument();
    expect(screen.queryByText('Reusable certified recipe')).not.toBeInTheDocument();
  });
});

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MealPlan } from '@/types';
import { MealsWorkspaceModals } from './MealsWorkspaceModals';
import type { SwapOption, useMealsWorkspace } from './useMealsWorkspace';

vi.mock('@/components/user/MealImage', () => ({ default: () => <span>Meal image</span> }));

const current = {
  id: 'slot-1',
  libraryMealId: 'recipe-current',
  mealName: 'Current breakfast',
  mealType: 'BREAKFAST',
  scheduledDate: '2026-10-01',
  calories: 400,
  proteinG: 20,
  carbsG: 50,
  fatG: 10,
} as MealPlan;

function option(id: string, mealName: string): SwapOption {
  return {
    id,
    mealName,
    mealType: 'BREAKFAST',
    mealTypes: ['BREAKFAST'],
    calories: 390,
    proteinG: 19,
    carbsG: 49,
    fatG: 11,
    isFavorite: false,
    verifiedBy: 'Reviewer',
    prcLicenseNumber: 'fixture',
  };
}

describe('meal swap picker', () => {
  it('shows only slot-approved replacements and keeps confirmation disabled until preview succeeds', () => {
    const eligible = option('recipe-eligible', 'Eligible breakfast');
    const generalOnly = option('recipe-general', 'General library breakfast');
    const workspace = {
      activeSwapMeal: current,
      setActiveSwapMeal: vi.fn(),
      swapOptions: [eligible],
      setSwapOptions: vi.fn(),
      isOptionsLoading: false,
      swapOptionsError: null,
      setSwapOptionsError: vi.fn(),
      confirmSwapMeal: eligible,
      setConfirmSwapMeal: vi.fn(),
      isSwapping: false,
      swapPreview: null,
      setSwapPreview: vi.fn(),
      isCheckingPreview: false,
      previewError: 'Could not preview this meal.',
      selectedVerifier: null,
      setSelectedVerifier: vi.fn(),
      handleSelectSwapOption: vi.fn(),
      handleConfirmSwapAnyway: vi.fn(),
      toggleSwapFavorite: vi.fn(),
      libraryMeals: [eligible, generalOnly],
    } as unknown as ReturnType<typeof useMealsWorkspace>;

    render(<MealsWorkspaceModals workspace={workspace} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('Eligible breakfast').length).toBeGreaterThan(0);
    expect(within(dialog).queryByText('General library breakfast')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirm Swap' })).toBeDisabled();
  });
});

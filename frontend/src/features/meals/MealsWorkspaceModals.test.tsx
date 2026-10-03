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
  it('shows current rice and fresh whole-plate rice without claiming source certification', () => {
    const source = {
      ...option('source:recipe', 'Replacement chicken'),
      reuseBasis: 'PANLASANG_GENERAL_BASE',
      canFavorite: false,
      verifiedBy: 'Panlasang Pinoy source',
      riceRole: 'PAIR_WITH_RICE',
      pairedRiceG: 150,
      ricePortionLabel: '1 cup cooked rice (150 g)',
      servingDescription: 'One dish serving + 1 cup cooked rice (150 g)',
    };
    const workspace = {
      activeSwapMeal: { ...current, ricePortion: '½ cup cooked rice (75 g)' },
      swapOptions: [source],
      confirmSwapMeal: source,
      swapPreview: null,
      isOptionsLoading: false,
      isCheckingPreview: false,
      setActiveSwapMeal: vi.fn(),
      setSwapOptions: vi.fn(),
      setConfirmSwapMeal: vi.fn(),
      setSwapOptionsError: vi.fn(),
      setSwapPreview: vi.fn(),
      handleSelectSwapOption: vi.fn(),
      toggleSwapFavorite: vi.fn(),
      setSelectedVerifier: vi.fn(),
    } as unknown as ReturnType<typeof useMealsWorkspace>;
    render(<MealsWorkspaceModals workspace={workspace} />);
    expect(screen.getByText('+ ½ cup cooked rice (75 g)')).toBeInTheDocument();
    expect(screen.getByText('+ 1 cup cooked rice (150 g)')).toBeInTheDocument();
    expect(screen.getByText('One dish serving + 1 cup cooked rice (150 g)')).toBeInTheDocument();
    expect(screen.queryByText(/Verified by/)).not.toBeInTheDocument();
    expect(screen.getByText(/Source:/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Favorite Replacement chicken' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm Swap' })).toBeDisabled();
  });
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

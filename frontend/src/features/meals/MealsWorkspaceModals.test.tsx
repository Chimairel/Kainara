import { fireEvent, render, screen, within } from '@testing-library/react';
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
    verifiedBy: 'Reviewer',
    prcLicenseNumber: 'fixture',
  };
}

describe('meal swap picker', () => {
  it('shows swap progress and prevents dismissal and replacement changes while submitting', () => {
    const select = vi.fn();
    const close = vi.fn();
    const workspace = {
      activeSwapMeal: current,
      swapOptions: [option('other', 'Other meal')],
      isSwapping: true,
      setActiveSwapMeal: close,
      handleSelectSwapOption: select,
    } as unknown as ReturnType<typeof useMealsWorkspace>;
    const { rerender } = render(<MealsWorkspaceModals workspace={workspace} />);
    expect(screen.getByText('Swapping your meal…')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
    fireEvent.click(screen.getByText('Other meal'));
    expect(select).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(close).not.toHaveBeenCalled();
    rerender(<MealsWorkspaceModals workspace={{ ...workspace, isRefreshingSwap: true }} />);
    expect(screen.getByText('Meal swapped. Refreshing your plan…')).toBeInTheDocument();
  });
  it('announces limited matches only when every available option leaves macro gaps', () => {
    const workspace = {
      activeSwapMeal: current,
      swapOptions: [{ ...option('gap', 'Eligible plate'), nutritionMatch: 'GAPS_REMAIN' }],
    } as unknown as ReturnType<typeof useMealsWorkspace>;
    const { rerender } = render(<MealsWorkspaceModals workspace={workspace} />);
    expect(screen.getByText('Closest available — macro gaps remain')).toBeInTheDocument();
    rerender(
      <MealsWorkspaceModals
        workspace={{
          ...workspace,
          swapOptions: [...workspace.swapOptions, { ...option('close', 'Close plate'), nutritionMatch: 'CLOSE' }],
        }}
      />
    );
    expect(screen.queryByText('Closest available — macro gaps remain')).not.toBeInTheDocument();
    expect(screen.getByText('Close plate')).toBeInTheDocument();
  });
  it('labels remaining gaps and unavailable targets without hiding eligible choices', () => {
    const workspace = {
      activeSwapMeal: current,
      swapOptions: [
        { ...option('close', 'Balanced option'), nutritionFitScore: 0.4, nutritionMatch: 'CLOSE' },
        { ...option('gap', 'Option with gaps'), nutritionFitScore: 12, nutritionMatch: 'GAPS_REMAIN' },
        { ...option('partial', 'Incomplete day option'), nutritionMatch: 'PARTIAL_DAY' },
        option('legacy', 'Option without target'),
      ],
    } as unknown as ReturnType<typeof useMealsWorkspace>;
    render(<MealsWorkspaceModals workspace={workspace} />);
    expect(screen.getByText('Close daily macro match')).toBeInTheDocument();
    expect(screen.getByText('Daily macro gaps remain')).toBeInTheDocument();
    expect(screen.getByText('Partial day — match is provisional')).toBeInTheDocument();
    expect(screen.getByText('Nutrition match unavailable')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'kcal_match' } });
    expect(screen.queryByText('Close daily macro match')).not.toBeInTheDocument();
    expect(screen.getByText('Option with gaps')).toBeInTheDocument();
    expect(
      screen.getByText('Ranked by calories for the whole plate. Protein, carbs and fat can differ.')
    ).toBeInTheDocument();
  });
  it('fixes the meal time and exposes only nutrition and kcal sorting', () => {
    const breakfast = option('breakfast', 'Suitable breakfast');
    const dinner = { ...option('dinner', 'Dinner-only dish'), mealType: 'DINNER', mealTypes: ['DINNER'] };
    const workspace = { activeSwapMeal: current, swapOptions: [breakfast, dinner] } as unknown as ReturnType<
      typeof useMealsWorkspace
    >;
    render(<MealsWorkspaceModals workspace={workspace} />);
    expect(screen.getByText('Suitable breakfast')).toBeInTheDocument();
    expect(screen.queryByText('Dinner-only dish')).not.toBeInTheDocument();
    expect(screen.getAllByRole('combobox')).toHaveLength(1);
    expect(screen.getAllByRole('option').map((entry) => entry.textContent)).toEqual(['Nutrition match', 'Kcal match']);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Favorites|All Types|Breakfast|Lunch|Dinner/ })
    ).not.toBeInTheDocument();
  });
  it('lets users sort whole plates by closest kcal without removing the macro-aware option', () => {
    const nutrition = { ...option('balanced', 'Balanced plate'), calories: 380, nutritionFitScore: 0.1 };
    const kcal = {
      ...option('closest', 'Closest calorie plate'),
      calories: 399,
      nutritionFitScore: 0.8,
      ricePortionLabel: '½ cup cooked rice (75 g)',
    };
    const workspace = {
      activeSwapMeal: current,
      swapOptions: [kcal, nutrition],
      setActiveSwapMeal: vi.fn(),
      setSwapOptions: vi.fn(),
      setConfirmSwapMeal: vi.fn(),
      setSwapOptionsError: vi.fn(),
      setSwapPreview: vi.fn(),
      setSelectedVerifier: vi.fn(),
      handleSelectSwapOption: vi.fn(),
    } as unknown as ReturnType<typeof useMealsWorkspace>;
    render(<MealsWorkspaceModals workspace={workspace} />);
    const plateButtons = () =>
      screen
        .getAllByRole('button')
        .filter((button) => /Balanced plate|Closest calorie plate/.test(button.textContent ?? ''));
    expect(plateButtons()[0]).toHaveTextContent('Balanced plate');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort mini library recipes' }), {
      target: { value: 'kcal_match' },
    });
    expect(plateButtons()[0]).toHaveTextContent('Closest calorie plate');
    expect(screen.getByRole('option', { name: 'Nutrition match' })).toBeInTheDocument();
    expect(screen.getByText('+ ½ cup cooked rice (75 g)')).toBeInTheDocument();
  });
  it('shows current rice and fresh whole-plate rice without claiming source certification', () => {
    const source = {
      ...option('source:recipe', 'Replacement chicken'),
      reuseBasis: 'PANLASANG_GENERAL_BASE',
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
      libraryMeals: [eligible, generalOnly],
    } as unknown as ReturnType<typeof useMealsWorkspace>;

    render(<MealsWorkspaceModals workspace={workspace} />);
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByText('Eligible breakfast').length).toBeGreaterThan(0);
    expect(within(dialog).queryByText('General library breakfast')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Confirm Swap' })).toBeDisabled();
  });
});

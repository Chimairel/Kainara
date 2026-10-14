import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ReviewSwapDialog from './ReviewSwapDialog';

vi.mock('@/features/meals/swap/SwapMealComparison', () => ({ default: () => null }));
vi.mock('@/features/meals/swap/SwapMealOptions', () => ({
  default: ({
    model,
  }: {
    model: {
      setSelectedVerifier: (verifier: { name: string; prcLicenseNumber: string; prcLicenseExpiry: string }) => void;
    };
  }) => (
    <button
      onClick={() =>
        model.setSelectedVerifier({ name: 'First recipe reviewer', prcLicenseNumber: '', prcLicenseExpiry: '' })
      }
    >
      View recipe reviewer
    </button>
  ),
}));

type Props = ComponentProps<typeof ReviewSwapDialog>;
function fixture() {
  return {
    meal: { id: 'first-case', mealType: 'LUNCH', calories: 400 },
    swap: {
      open: true,
      data: { options: [{ id: 'certified-choice' }] },
      selected: null,
      loading: false,
      saving: false,
      note: '',
      close: vi.fn(),
      submit: vi.fn(),
      load: vi.fn(),
      setNote: vi.fn(),
    },
  } as unknown as Props;
}

it('closes the recipe reviewer overlay when switching cases', () => {
  const props = fixture();
  const { rerender } = render(<ReviewSwapDialog {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'View recipe reviewer' }));
  expect(screen.getByRole('dialog', { name: 'Recorded RND credentials' })).toBeInTheDocument();
  rerender(<ReviewSwapDialog {...props} meal={{ ...props.meal, id: 'second-case' }} />);
  expect(screen.queryByRole('dialog', { name: 'Recorded RND credentials' })).not.toBeInTheDocument();
});

it('does not reopen old credentials after closing the swap or refreshing options', () => {
  const props = fixture();
  const { rerender } = render(<ReviewSwapDialog {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'View recipe reviewer' }));
  rerender(<ReviewSwapDialog {...props} swap={{ ...props.swap, open: false }} />);
  rerender(<ReviewSwapDialog {...props} />);
  expect(screen.queryByRole('dialog', { name: 'Recorded RND credentials' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'View recipe reviewer' }));
  rerender(<ReviewSwapDialog {...props} swap={{ ...props.swap, data: { ...props.swap.data!, options: [] } }} />);
  expect(screen.queryByRole('dialog', { name: 'Recorded RND credentials' })).not.toBeInTheDocument();
});
it('offers broader preparation and a distinct hold after an empty certified search', () => {
  const props = fixture(),
    find = vi.fn(),
    hold = vi.fn();
  render(
    <ReviewSwapDialog
      {...props}
      swap={{ ...props.swap, data: { ...props.swap.data!, options: [], searchReceipt: 'signed-search' } }}
      onFindReplacement={find}
      onNoSuitable={hold}
    />
  );
  expect(screen.getByText('No replacements match this search.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Reject and find replacement' }));
  expect(find).toHaveBeenCalledOnce();
  expect(hold).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Reject and leave unavailable' }));
  expect(hold).toHaveBeenCalledOnce();
});

it('exposes the AI input and exact applied limits without hiding manual nutrient controls', () => {
  const props = fixture(),
    apply = vi.fn(),
    change = vi.fn();
  render(
    <ReviewSwapDialog
      {...props}
      swap={{
        ...props.swap,
        filtersEnabled: true,
        filterText: 'sugar less than 200 g',
        setFilterText: change,
        interpretAndSearch: apply,
        filterDraft: {},
        setFilterDraft: vi.fn(),
        data: { ...props.swap.data!, filters: { sugarG: { max: 200, maxExclusive: true } } },
      }}
    />
  );
  expect(screen.getByLabelText('Filter candidates with AI')).toHaveValue('sugar less than 200 g');
  expect(screen.getByRole('list', { name: 'Applied nutrient limits' })).toHaveTextContent('Sugar < 200 g');
  fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
  expect(apply).toHaveBeenCalledOnce();
  expect(screen.getByText('Filter complete-plate nutrients')).toBeInTheDocument();
});

it('compares the recorded meal and complete replacement serving without grocery impact', () => {
  const props = fixture();
  const meal = {
    ...props.meal,
    calories: 1190.4,
    proteinG: 38.6,
    carbsG: 153.8,
    fatG: 47.4,
    nutrients: { sodiumMg: 1000, sugarG: 0, fiberG: null },
  };
  const selected = {
    id: 'replacement',
    calories: 1040.4,
    proteinG: 37.6,
    carbsG: 147,
    fatG: 35,
    ingredients: [],
    nutrients: {
      calories: 999,
      proteinG: 37.6,
      carbsG: 147,
      fatG: 35,
      sodiumMg: 500,
      sugarG: 0,
      fiberG: null,
      potassiumMg: null,
      phosphorusMg: null,
      saturatedFatG: null,
    },
  } as unknown as NonNullable<Props['swap']['selected']>;
  render(<ReviewSwapDialog {...props} meal={meal} swap={{ ...props.swap, selected }} />);
  const comparison = screen.getByRole('region', { name: 'Meal nutrition comparison' });
  expect(within(comparison).getByRole('row', { name: 'Energy 1190.4 kcal 1040.4 kcal -150 kcal' })).toBeInTheDocument();
  expect(within(comparison).getByRole('row', { name: 'Protein 38.6 g 37.6 g -1 g' })).toBeInTheDocument();
  expect(within(comparison).getByRole('row', { name: 'Sodium 1000 mg 500 mg -500 mg' })).toBeInTheDocument();
  expect(within(comparison).getByRole('row', { name: 'Sugar 0 g 0 g 0 g' })).toBeInTheDocument();
  expect(
    within(comparison).getByRole('row', { name: 'Fiber Not recorded Not recorded Not recorded' })
  ).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Grocery changes' })).not.toBeInTheDocument();
  expect(screen.queryByText(/No changes to remaining groceries/)).not.toBeInTheDocument();
  expect(within(comparison).queryByText('999 kcal')).not.toBeInTheDocument();
});

it('updates the comparison for a new selection and removes it when selection clears', () => {
  const props = fixture();
  const meal = { ...props.meal, calories: 400, proteinG: 20, carbsG: 40, fatG: 15 };
  const selected = {
    id: 'replacement',
    calories: 450,
    proteinG: 25,
    carbsG: 50,
    fatG: 16,
    ingredients: [],
  } as unknown as NonNullable<Props['swap']['selected']>;
  const { rerender } = render(<ReviewSwapDialog {...props} meal={meal} swap={{ ...props.swap, selected }} />);
  expect(screen.getByRole('row', { name: 'Energy 400 kcal 450 kcal +50 kcal' })).toBeInTheDocument();
  rerender(
    <ReviewSwapDialog
      {...props}
      meal={meal}
      swap={{ ...props.swap, selected: { ...selected, id: 'second', calories: 400 } }}
    />
  );
  expect(screen.getByRole('row', { name: 'Energy 400 kcal 400 kcal 0 kcal' })).toBeInTheDocument();
  rerender(<ReviewSwapDialog {...props} meal={meal} swap={{ ...props.swap, selected: null }} />);
  expect(screen.queryByRole('region', { name: 'Meal nutrition comparison' })).not.toBeInTheDocument();
});

it('shows completed capstone nutrients normally without additional notices', () => {
  const props = fixture();
  const selected = {
    id: 'replacement',
    calories: 450,
    proteinG: 25,
    carbsG: 50,
    fatG: 16,
    ingredients: [],
    nutritionBasis: 'CALCULATED_DEMO',
    nutrients: { sodiumMg: 300, phosphorusMg: 200 },
    estimatedNutrientKeys: ['sodiumMg', 'phosphorusMg'],
  } as unknown as NonNullable<Props['swap']['selected']>;
  render(<ReviewSwapDialog {...props} meal={{ ...props.meal, estimatedNutrientKeys: ['sodiumMg'] }} swap={{ ...props.swap, selected }} />);
  const comparison = screen.getByRole('region', { name: 'Meal nutrition comparison' });
  expect(comparison).not.toHaveTextContent(/estimated|approximations|demonstration recipe/i);
  expect(comparison).toHaveTextContent('300 mg');
  expect(comparison).toHaveTextContent('200 mg');
});

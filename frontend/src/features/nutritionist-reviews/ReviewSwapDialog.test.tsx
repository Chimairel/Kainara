import type { ComponentProps } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ReviewSwapDialog from './ReviewSwapDialog';

vi.mock('@/components/user/MealImage', () => ({ default: () => null }));

type Props = ComponentProps<typeof ReviewSwapDialog>;
function fixture() {
  return {
    meal: { id: 'first-case', mealType: 'LUNCH', mealName: 'Current meal', calories: 400, proteinG: 20, carbsG: 40, fatG: 15 },
    swap: {
      open: true,
      data: { options: [{ id: 'certified-choice', mealName: 'Replacement soup', mealType: 'LUNCH', calories: 450, proteinG: 25, carbsG: 50, fatG: 16, ingredients: [], verifier: { name: 'First recipe reviewer', prcLicenseNumber: '', prcLicenseExpiry: '' } }] },
      selected: null,
      loading: false,
      saving: false,
      note: '',
      close: vi.fn(),
      submit: vi.fn(),
      load: vi.fn(),
      setNote: vi.fn(),
      setSelectedId: vi.fn(),
    },
  } as unknown as Props;
}

it('keeps selection, comparison and rationale accessible together without large duplicate meal cards', () => {
  const props = fixture();
  const selected = props.swap.data!.options[0];
  render(<ReviewSwapDialog {...props} swap={{ ...props.swap, selected, note: 'Fits the recorded meal target.' }} />);
  expect(screen.getByRole('region', { name: 'Find a replacement' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Selected replacement review' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Select Replacement soup' }));
  expect(props.swap.setSelectedId).toHaveBeenCalledWith('certified-choice');
  expect(screen.getByRole('button', { name: 'Confirm swap' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm swap' }));
  expect(props.swap.submit).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Change selection' }));
  expect(props.swap.setSelectedId).toHaveBeenLastCalledWith('');
  expect(screen.getByText('Replacement ingredients')).toBeInTheDocument();
});

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
  fireEvent.click(screen.getByText('No suitable replacement?'));
  fireEvent.click(screen.getByRole('button', { name: 'Reject and leave unavailable' }));
  expect(hold).toHaveBeenCalledOnce();
});

it('keeps structured filter drafts inside the swap dialog and applies them together without AI', () => {
  const props = fixture(), applyFilters = vi.fn();
  render(<ReviewSwapDialog {...props} swap={{ ...props.swap, filtersEnabled: true, filterDraft: {}, searchText: '', applyFilters }} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Search meals or ingredients' }), { target: { value: 'pork' } });
  fireEvent.click(screen.getByRole('button', { name: 'Filters' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Add nutrient filter' }));
  fireEvent.click(screen.getByRole('option', { name: 'Protein (g)' }));
  fireEvent.click(screen.getByRole('combobox', { name: 'Protein comparison' }));
  fireEvent.click(screen.getByRole('option', { name: 'Exactly =' }));
  fireEvent.change(screen.getByLabelText('Protein exact amount (g)'), { target: { value: '35.7' } });
  fireEvent.click(screen.getByRole('combobox', { name: 'Add nutrient filter' }));
  fireEvent.click(screen.getByRole('option', { name: /^Fat \(g\)$/ }));
  fireEvent.change(screen.getByLabelText('Fat maximum (g)'), { target: { value: '14.6' } });
  expect(applyFilters).not.toHaveBeenCalled();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Select Replacement soup' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(applyFilters).toHaveBeenCalledWith({ proteinG: { mode: 'exact', min: '35.7' }, fatG: { mode: 'max', max: '14.6' } }, 'pork');
  expect(screen.queryByRole('region', { name: 'Replacement filters' })).not.toBeInTheDocument();
  expect(screen.queryByText('Filter candidates with AI')).not.toBeInTheDocument();
});

it('removes applied chips and clears all search criteria with one request', () => {
  const props = fixture(), applyFilters = vi.fn();
  render(<ReviewSwapDialog {...props} swap={{ ...props.swap, filtersEnabled: true,
    filterDraft: { sodiumMg: { max: '500' } }, searchText: 'pork', applyFilters,
    data: { ...props.swap.data!, search: 'pork', filters: { sodiumMg: { max: 500 } } } }} />);
  const chips = screen.getByRole('list', { name: 'Applied replacement filters' });
  expect(chips).toHaveTextContent('Sodium ≤ 500.0 mg');
  fireEvent.click(screen.getByRole('button', { name: 'Remove applied Sodium filter' }));
  expect(applyFilters).toHaveBeenLastCalledWith({}, 'pork');
  fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
  expect(applyFilters).toHaveBeenLastCalledWith({}, '');
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
    mealName: 'Replacement soup', mealType: 'LUNCH',
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
  expect(within(comparison).getByRole('row', { name: 'Energy 1190.4 kcal 1040.4 kcal Not set' })).toBeInTheDocument();
  expect(within(comparison).getByRole('row', { name: 'Protein 38.6 g 37.6 g Not set' })).toBeInTheDocument();
  expect(within(comparison).getByRole('row', { name: 'Sodium 1000.0 mg 500.0 mg Not set' })).toBeInTheDocument();
  expect(within(comparison).getByRole('row', { name: 'Sugar 0.0 g 0.0 g Not set' })).toBeInTheDocument();
  expect(
    within(comparison).getByRole('row', { name: 'Fiber Not recorded Not recorded Not set' })
  ).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Grocery changes' })).not.toBeInTheDocument();
  expect(screen.queryByText(/No changes to remaining groceries/)).not.toBeInTheDocument();
  expect(within(comparison).queryByText('999.0 kcal')).not.toBeInTheDocument();
});

it('updates the comparison for a new selection and removes it when selection clears', () => {
  const props = fixture();
  const meal = { ...props.meal, calories: 400, proteinG: 20, carbsG: 40, fatG: 15 };
  const selected = {
    id: 'replacement',
    mealName: 'Replacement soup', mealType: 'LUNCH',
    calories: 450,
    proteinG: 25,
    carbsG: 50,
    fatG: 16,
    ingredients: [],
  } as unknown as NonNullable<Props['swap']['selected']>;
  const { rerender } = render(<ReviewSwapDialog {...props} meal={meal} swap={{ ...props.swap, selected }} />);
  expect(screen.getByRole('row', { name: 'Energy 400.0 kcal 450.0 kcal Not set' })).toBeInTheDocument();
  rerender(
    <ReviewSwapDialog
      {...props}
      meal={meal}
      swap={{ ...props.swap, selected: { ...selected, id: 'second', calories: 400 } }}
    />
  );
  expect(screen.getByRole('row', { name: 'Energy 400.0 kcal 400.0 kcal Not set' })).toBeInTheDocument();
  rerender(<ReviewSwapDialog {...props} meal={meal} swap={{ ...props.swap, selected: null }} />);
  expect(screen.queryByRole('region', { name: 'Meal nutrition comparison' })).not.toBeInTheDocument();
});

it('shows completed capstone nutrients normally without additional notices', () => {
  const props = fixture();
  const selected = {
    id: 'replacement',
    mealName: 'Replacement soup', mealType: 'LUNCH',
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
  expect(comparison).toHaveTextContent('300.0 mg');
  expect(comparison).toHaveTextContent('200.0 mg');
});

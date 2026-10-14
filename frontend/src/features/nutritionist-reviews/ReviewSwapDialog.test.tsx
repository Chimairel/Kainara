import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
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
it('offers broader preparation and a distinct hold after an empty certified search',()=>{
 const props=fixture(), find=vi.fn(), hold=vi.fn();
 render(<ReviewSwapDialog {...props} swap={{...props.swap,data:{...props.swap.data!,options:[],searchReceipt:'signed-search'}}} onFindReplacement={find} onNoSuitable={hold}/>);
 expect(screen.getByText('No replacements match this search.')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Reject and find replacement'}));expect(find).toHaveBeenCalledOnce();expect(hold).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Reject and leave unavailable'}));expect(hold).toHaveBeenCalledOnce();
});

it('exposes the AI input and exact applied limits without hiding manual nutrient controls', () => {
 const props=fixture(), apply=vi.fn(), change=vi.fn();
 render(<ReviewSwapDialog {...props} swap={{...props.swap, filtersEnabled:true, filterText:'sugar less than 200 g', setFilterText:change, interpretAndSearch:apply, filterDraft:{}, setFilterDraft:vi.fn(), data:{...props.swap.data!,filters:{sugarG:{max:200,maxExclusive:true}}}}}/>);
 expect(screen.getByLabelText('Filter candidates with AI')).toHaveValue('sugar less than 200 g');
 expect(screen.getByRole('list',{name:'Applied nutrient limits'})).toHaveTextContent('Sugar < 200 g');
 fireEvent.click(screen.getByRole('button',{name:'Filter'}));expect(apply).toHaveBeenCalledOnce();
 expect(screen.getByText('Filter complete-plate nutrients')).toBeInTheDocument();
});

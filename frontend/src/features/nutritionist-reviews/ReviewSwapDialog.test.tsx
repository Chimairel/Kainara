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
      data: { options: [] },
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

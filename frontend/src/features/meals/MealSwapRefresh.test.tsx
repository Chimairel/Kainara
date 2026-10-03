import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MealSwapRefresh from './MealSwapRefresh';

describe('meal card refresh after a swap', () => {
  it('replaces only the affected card with a spinner and removes its stale actions', () => {
    const { rerender } = render(
      <>
        <MealSwapRefresh refreshing={false} mealType="BREAKFAST">
          <button>Breakfast</button>
        </MealSwapRefresh>
        <MealSwapRefresh refreshing mealType="LUNCH">
          <button>Old lunch</button>
        </MealSwapRefresh>
      </>
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Updating your lunch meal…')).toHaveClass('sr-only');
    expect(screen.queryByRole('button', { name: 'Old lunch' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Breakfast' })).toBeEnabled();
    rerender(
      <MealSwapRefresh refreshing={false} mealType="LUNCH">
        <button>New lunch</button>
      </MealSwapRefresh>
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New lunch' })).toBeEnabled();
  });
});

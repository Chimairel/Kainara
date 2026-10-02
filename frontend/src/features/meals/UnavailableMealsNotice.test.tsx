import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import UnavailableMealsNotice from './UnavailableMealsNotice';

describe('unavailable meal warning', () => {
  it('keeps a visible explanation with a replacement action for retired current slots', () => {
    const repair = vi.fn();
    render(<UnavailableMealsNotice cycle={{ unavailableMealCount: 2, retiredMealCount: 1 }} onRepair={repair} />);
    expect(screen.getByRole('status')).toHaveTextContent('2 unavailable meals');
    expect(screen.queryByRole('button', { name: /close|dismiss/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace retired meals' }));
    expect(repair).toHaveBeenCalledTimes(1);
  });
  it('does not advertise replacement as a clearance bypass or show a current repair for upcoming slots', () => {
    const { rerender } = render(
      <UnavailableMealsNotice cycle={{ unavailableMealCount: 1, retiredMealCount: 0 }} onRepair={vi.fn()} />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<UnavailableMealsNotice cycle={{ unavailableMealCount: 1, retiredMealCount: 1 }} upcoming />);
    expect(screen.getByRole('status')).toHaveTextContent('Upcoming plan');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

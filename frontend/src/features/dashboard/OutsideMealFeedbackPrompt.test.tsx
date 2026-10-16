import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import OutsideMealModal from './OutsideMealModal';
vi.mock('@/features/membership/MembershipProvider', () => ({
  useMembership: () => ({ data: { enabled: false }, isLoading: false, error: null, refresh: vi.fn() }),
}));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
const props = {
  isOpen: false,
  isLoading: false,
  mealName: '',
  mealType: 'LUNCH' as const,
  notes: '',
  warning: null,
  onClose: vi.fn(),
  onMealNameChange: vi.fn(),
  onMealTypeChange: vi.fn(),
  onNotesChange: vi.fn(),
  onSubmit: vi.fn(),
  onWarningCancel: vi.fn(),
};
it('offers feedback only for a saved log, and closing the prompt cannot save or undo food', () => {
  const dismiss = vi.fn(),
    request = vi.fn();
  const { rerender } = render(
    <OutsideMealModal
      {...props}
      savedFood={{ logId: 'log', itemId: 'item' }}
      onDismissFeedback={dismiss}
      onRequestFeedback={request}
    />
  );
  expect(screen.getByRole('dialog', { name: 'Food logged' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Request RND feedback' }));
  expect(request).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: /Close/ }));
  expect(dismiss).toHaveBeenCalledOnce();
  expect(props.onSubmit).not.toHaveBeenCalled();
  expect(screen.getByRole('link', { name: 'View Meal history' })).toHaveAttribute('href', '/meals?tab=history');
  rerender(<OutsideMealModal {...props} savedFood={null} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import AccessControl from './AccessControl';
import type { NutritionistRow } from './model';
it('revokes access only after the administrator reviews and confirms a reason', async () => {
  const onChange = vi.fn().mockResolvedValue(undefined);
  const professional = { user: { name: 'Test Dietitian', isSuspended: false } } as NutritionistRow;
  render(<AccessControl professional={professional} busy={false} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Revoke access' }));
  expect(onChange).not.toHaveBeenCalled();
  expect(screen.getByText('Past reviews and audit records are preserved.')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm revocation' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Reason'), { target: { value: 'Engagement ended' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm revocation' }));
  await waitFor(() => expect(onChange).toHaveBeenCalledWith(true, 'Engagement ended'));
});

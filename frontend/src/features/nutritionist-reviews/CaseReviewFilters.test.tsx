import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CaseReviewFilters from './CaseReviewFilters';

it('shows independent activity indicators and clears each when its queue is empty', () => {
  const onChange = vi.fn();
  const { rerender } = render(<CaseReviewFilters value="pending" onChange={onChange} pending={3} outside={1} />);
  expect(screen.getByRole('button', { name: /Pending/ })).toHaveTextContent('3 cases waiting');
  fireEvent.click(screen.getByRole('button', { name: /Outside food logs/ }));
  expect(onChange).toHaveBeenCalledWith('outside');
  rerender(<CaseReviewFilters value="outside" onChange={onChange} pending={3} outside={0} />);
  expect(screen.queryByText('1 feedback request waiting')).not.toBeInTheDocument();
  expect(screen.getByText('3 cases waiting')).toBeInTheDocument();
});

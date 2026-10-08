import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import WorkspaceTabs from './WorkspaceTabs';

describe('RND review count badges', () => {
  it('shows outstanding work with 99+ display caps and keeps each queue selectable', () => {
    const onChange = vi.fn();
    render(<WorkspaceTabs value="case" onChange={onChange} counts={{ meal: 2, case: 125, profile: 1 }} />);
    expect(screen.getByRole('button', { name: /Meal verification/ })).toHaveTextContent('2');
    expect(screen.getByRole('button', { name: /Case approval/ })).toHaveTextContent('99+');
    expect(screen.getByRole('button', { name: /Member queue/ })).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: /Member queue/ }));
    expect(onChange).toHaveBeenCalledWith('profile');
  });

  it('does not show a badge for an empty queue', () => {
    render(<WorkspaceTabs value="meal" onChange={() => {}} counts={{ meal: 0, case: 0, profile: 0 }} />);
    expect(screen.getByRole('button', { name: 'Meal verification' })).toHaveTextContent('Meal verification');
  });
});

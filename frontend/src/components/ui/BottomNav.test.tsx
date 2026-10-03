import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import BottomNav from './BottomNav';
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { role: 'USER' } }) }));
vi.mock('@/components/ui/ProfileWidget', () => ({ default: () => <p>Profile options</p> }));
it('provides fixed touch targets and keeps navigation clickable with the profile menu open', () => {
  render(<BottomNav />);
  const meals = screen.getByRole('link', { name: 'Meals' });
  expect(meals).toHaveClass('touch-manipulation', 'min-h-[52px]');
  expect(meals).toHaveAttribute('href', '/meals');
  fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
  expect(screen.getByText('Profile options')).toBeInTheDocument();
  fireEvent.click(meals);
  expect(screen.queryByText('Profile options')).not.toBeInTheDocument();
  expect(meals).toHaveAttribute('aria-current', 'page');
});

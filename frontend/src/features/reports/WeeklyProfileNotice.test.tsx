import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import WeeklyProfileNotice from './WeeklyProfileNotice';
const state = vi.hoisted(() => ({
  data: null as null | {
    isDue: boolean;
    hasPendingChanges?: boolean;
    safetyChanged?: boolean;
    weeksSinceConfirmation?: number;
  },
  refetch: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'weekly-fixture', onboardingDone: true, tosAccepted: true } }),
}));
vi.mock('@/hooks/useSessionQuery', () => ({ useSessionQuery: () => state }));
vi.mock('@/components/user/CheckinModal', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <p>Check-in opened</p> : null),
}));
beforeEach(() => {
  state.data = null;
  vi.clearAllMocks();
});
describe('weekly profile reminders', () => {
  it('persists overdue reminders, opens the check-in and clears after a current confirmation', () => {
    state.data = { isDue: true, weeksSinceConfirmation: 3 };
    const view = render(<WeeklyProfileNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('3 weeks ago');
    expect(screen.queryByRole('button', { name: /dismiss|close/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete check-in' }));
    expect(screen.getByText('Check-in opened')).toBeInTheDocument();
    state.data = { isDue: false, hasPendingChanges: false };
    view.rerender(<WeeklyProfileNotice />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
  it('shows unapplied updates separately from weekly freshness and refreshes after submission', () => {
    state.data = { isDue: false, hasPendingChanges: true, safetyChanged: true };
    render(<WeeklyProfileNotice />);
    expect(screen.getByRole('status')).toHaveTextContent('Affected recommendations need revalidation');
    expect(screen.queryByRole('button', { name: 'Complete check-in' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Review report' })).toHaveAttribute('href', '/profile/nutrition-report');
    window.dispatchEvent(new Event('kainara:checkin-updated'));
    expect(state.refetch).toHaveBeenCalledOnce();
  });
});

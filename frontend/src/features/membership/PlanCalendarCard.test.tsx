import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PlanCalendarCard from './PlanCalendarCard';
import type { MembershipView } from './MembershipProvider';
import { membershipSchedules, manilaDate } from './membership-schedule';

const current = {
  enabled: true,
  level: 'TRIAL',
  tier: 'HEALTH',
  serverTime: '2026-10-03T00:00:00Z',
  trialStartedAt: '2026-10-01T13:02:00Z',
  trialEndsAt: '2026-10-31T13:02:00Z',
  paidUntil: null,
  scheduledMemberships: [
    { id: 'next', tier: 'LIFESTYLE', effectiveFrom: '2026-10-31T13:02:00Z', effectiveUntil: '2026-11-30T13:02:00Z' },
  ],
} as Extract<MembershipView, { enabled: true }>;

describe('membership period calendar', () => {
  it('updates the month when a refreshed membership starts while preserving ordinary month navigation', () => {
    const { rerender } = render(<PlanCalendarCard data={current} />);
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    rerender(<PlanCalendarCard data={{ ...current, serverTime: '2026-10-03T00:01:00Z' }} />);
    expect(screen.getByText('September 2026')).toBeInTheDocument();
    rerender(
      <PlanCalendarCard
        data={{ ...current, trialStartedAt: '2026-11-01T13:02:00Z', trialEndsAt: '2026-11-30T13:02:00Z' }}
      />
    );
    expect(screen.getByText('November 2026')).toBeInTheDocument();
  });
  it('shows Health and switches to already paid Lifestyle without changing current access', () => {
    render(<PlanCalendarCard data={current} />);
    expect(screen.getByRole('combobox', { name: 'Membership period' })).toHaveTextContent('Current: Health');
    expect(screen.getByText('October 1, 2026')).toBeInTheDocument();
    expect(screen.getAllByText('9:02 PM')).toHaveLength(2);
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByText(/trial/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: /Next: Lifestyle/ }));
    expect(screen.getByText('November 30, 2026')).toBeInTheDocument();
    expect(screen.getByText(/no additional charge is needed/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('option', { name: 'Current: Health' }));
    expect(screen.getByText('October 1, 2026')).toBeInTheDocument();
  });
  it('keeps Free and pending Health dates empty', () => {
    const free = { ...current, level: 'FREE' as const, scheduledMemberships: [] };
    expect(membershipSchedules(free)[0]).toMatchObject({ start: null, end: null });
    const { rerender } = render(<PlanCalendarCard data={free} />);
    expect(screen.getByText('No expiry')).toBeInTheDocument();
    rerender(
      <PlanCalendarCard data={{ ...current, level: 'TRIAL_PENDING', trialStartedAt: null, trialEndsAt: null }} />
    );
    expect(screen.getByText('Not scheduled')).toBeInTheDocument();
    expect(screen.queryByText('No expiry')).not.toBeInTheDocument();
  });
  it('uses the Philippine calendar day across the UTC month boundary', () => {
    expect(manilaDate('2026-09-30T16:02:00Z')).toBe('2026-10-01');
    render(<PlanCalendarCard data={{ ...current, trialStartedAt: '2026-09-30T16:02:00Z' }} />);
    expect(screen.getByText('October 2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(screen.getByText('September 2026')).toBeInTheDocument();
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import WaterHistory, { type WaterHistoryData } from './WaterHistory';

const data: WaterHistoryData = {
  timeZone: 'Asia/Manila', startDate: '2026-10-10', endDate: '2026-10-16',
  days: Array.from({ length: 7 }, (_, offset) => ({ date: `2026-10-${10 + offset}`, totalMl: offset === 6 ? 275 : 0,
    entryCount: offset === 6 ? 2 : 0, entries: offset === 6 ? [
      { id: 'latest', amountMl: 25, loggedAt: '2026-10-16T01:00:00.000Z' },
      { id: 'earlier', amountMl: 250, loggedAt: '2026-10-15T16:00:00.000Z' },
    ] : [] })),
};

it('shows exact saved amounts and Manila times, with selectable days and an honest no-log state', () => {
  render(<WaterHistory data={data} />);
  expect(screen.getByText('275 mL logged')).toBeInTheDocument();
  const entries = within(screen.getByRole('list', { name: 'Saved water entries' }));
  expect(entries.getByText('25 mL')).toBeInTheDocument();
  expect(entries.getByText('9:00 AM')).toBeInTheDocument();
  expect(entries.getByText('12:00 AM')).toBeInTheDocument();
  const unlogged = screen.getByRole('button', { name: 'Saturday, Oct 10, 2026: no log' });
  fireEvent.click(unlogged);
  expect(unlogged).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('No water was logged on this day.')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Saved water entries' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Log water on Dashboard' })).toHaveAttribute('href', '/dashboard');
});

it('distinguishes unavailable history from a day with no entries and uses authoritative totals for bounded details', () => {
  const { rerender } = render(<WaterHistory />);
  expect(screen.getByText(/Water history is unavailable/)).toBeInTheDocument();
  expect(screen.queryByText('No water was logged on this day.')).not.toBeInTheDocument();
  const bounded = { ...data, days: data.days.map(day => day.date === data.endDate ? { ...day, entryCount: 60, totalMl: 15000 } : day) };
  rerender(<WaterHistory data={bounded} />);
  expect(screen.getByText('15,000 mL logged')).toBeInTheDocument();
  expect(screen.getByText(/Showing the latest 2 of 60 entries/)).toBeInTheDocument();
});

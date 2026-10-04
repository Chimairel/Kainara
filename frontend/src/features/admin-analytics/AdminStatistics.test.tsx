import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminStatistics from './AdminStatistics';
import { analyticsFixture } from './analytics-fixture';
const mocks = vi.hoisted(() => ({
  query: { data: null as unknown, error: null as string | null, isLoading: false, refetch: vi.fn() },
}));
vi.mock('./useAdminAnalytics', () => ({ useAdminAnalytics: () => mocks.query }));
beforeEach(() => {
  mocks.query.data = analyticsFixture;
  mocks.query.error = null;
  vi.clearAllMocks();
});
it('shows unique totals with accurate units and working workflow links', () => {
  render(<AdminStatistics />);
  expect(screen.getAllByText('Member accounts')).toHaveLength(1);
  expect(screen.getAllByText('Current plan cycles')).toHaveLength(1);
  expect(screen.getByText('USDA food records')).toBeInTheDocument();
  expect(screen.getByText(/not individual provider requests or retries/)).toBeInTheDocument();
  expect(screen.queryByText('Certified')).not.toBeInTheDocument();
  expect(screen.queryByText(/per 100/)).not.toBeInTheDocument();
  expect(
    screen.getAllByRole('link').some((link) => link.getAttribute('href') === '/admin/users?tab=nutritionists')
  ).toBe(true);
});
it('shows a refresh error beside the last snapshot and allows retry', () => {
  mocks.query.error = 'Could not refresh';
  render(<AdminStatistics />);
  expect(screen.getByRole('alert')).toHaveTextContent('Showing the last successful snapshot');
  expect(screen.getByText('Current plan cycles')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh statistics' }));
  expect(mocks.query.refetch).toHaveBeenCalledOnce();
});
it('does not present zero metrics when loading has failed', () => {
  mocks.query.data = null;
  mocks.query.error = 'Unavailable';
  render(<AdminStatistics />);
  expect(screen.getByRole('alert')).toHaveTextContent('Unavailable');
  expect(screen.queryByText('0')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  expect(mocks.query.refetch).toHaveBeenCalledOnce();
});

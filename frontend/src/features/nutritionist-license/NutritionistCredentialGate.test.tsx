import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import NutritionistCredentialGate from './NutritionistCredentialGate';
const state = vi.hoisted(() => ({
  path: '/nutritionist/reviews',
  query: {
    data: { eligible: false, reason: 'LICENSE_EXPIRED', expiryDate: '2026-10-04' },
    isLoading: false,
    error: null as string | null,
    refetch: vi.fn(),
  },
}));
vi.mock('next/navigation', () => ({ usePathname: () => state.path }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'rnd-a' } }) }));
vi.mock('@/hooks/useSessionQuery', () => ({ useSessionQuery: () => state.query }));
afterEach(() => {
  cleanup();
  state.path = '/nutritionist/reviews';
  state.query.error = null;
  state.query.data.eligible = false;
});
it('explains the recorded expiry and blocks review content', () => {
  render(
    <NutritionistCredentialGate>
      <p>Clinical queue</p>
    </NutritionistCredentialGate>
  );
  expect(screen.getByRole('heading', { name: 'Your recorded license has expired' })).toBeInTheDocument();
  expect(screen.queryByText('Clinical queue')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open RND profile' })).toHaveAttribute(
    'href',
    '/nutritionist/profile#license-update'
  );
});
it('allows expired RNDs to maintain their own profile', () => {
  state.path = '/nutritionist/profile';
  render(
    <NutritionistCredentialGate>
      <p>License update form</p>
    </NutritionistCredentialGate>
  );
  expect(screen.getByText('License update form')).toBeInTheDocument();
});
it('opens clinical content only for an eligible recorded credential', () => {
  state.query.data.eligible = true;
  render(
    <NutritionistCredentialGate>
      <p>Clinical queue</p>
    </NutritionistCredentialGate>
  );
  expect(screen.getByText('Clinical queue')).toBeInTheDocument();
});
it('reports a status request failure without suggesting an empty meal library', () => {
  state.query.error = 'The API did not respond. Try again.';
  render(
    <NutritionistCredentialGate>
      <p>Clinical queue</p>
    </NutritionistCredentialGate>
  );
  expect(screen.getByText('The API did not respond. Try again.')).toBeInTheDocument();
  expect(screen.queryByText('No Meals Found')).not.toBeInTheDocument();
});

import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminNutritionistsPage from '@/app/(admin)/admin/nutritionists/page';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'strict-admin' } }) }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(async () => ({ data: { success: true, data: [] } })) } }));
beforeEach(() => clearSessionResourceCache());
it('finishes initial governance loading after React Strict Mode cleans up and restarts effects', async () => {
  render(
    <StrictMode>
      <AdminNutritionistsPage />
    </StrictMode>
  );
  expect(await screen.findByText('No active applications.')).toBeInTheDocument();
  expect(screen.queryByText('Loading professional governance records...')).not.toBeInTheDocument();
});

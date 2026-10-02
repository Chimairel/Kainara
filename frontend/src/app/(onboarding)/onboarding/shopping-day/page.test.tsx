import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ShoppingDayPage from './page';
import { clearSessionResourceCache, readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

const state = vi.hoisted(() => ({ post: vi.fn(), push: vi.fn(), refreshSession: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: state.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/axios', () => ({ default: { post: state.post } }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { userId: 'fixture-user' }, refreshSession: state.refreshSession }),
}));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ isLoading: false, profile: { id: 'fixture-user', userProfile: {} } }),
}));

describe('shopping-day cache contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSessionResourceCache();
  });

  it('invalidates the full account snapshot instead of caching the partial schedule response', async () => {
    writeSessionResource('fixture-user', 'user-profile', {
      id: 'fixture-user',
      userProfile: {},
      onboardingStatus: { currentTermsVersion: '2026-09-27' },
    });
    state.post.mockResolvedValue({ data: { success: true, data: { userId: 'fixture-user', shoppingDayOfWeek: 0 } } });
    render(<ShoppingDayPage />);
    fireEvent.click(screen.getByRole('button', { name: /^Sunday/ }));
    fireEvent.submit(screen.getByRole('button', { name: /Continue/ }).closest('form')!);
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/onboarding/tos'));
    expect(state.post).toHaveBeenCalledWith('/user/onboarding/shopping-day', { shoppingDayOfWeek: 0 });
    expect(readSessionResource('fixture-user', 'user-profile')).toBeNull();
    expect(state.refreshSession).toHaveBeenCalledOnce();
  });
});

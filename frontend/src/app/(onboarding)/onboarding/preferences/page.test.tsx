import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import PreferencesPage from './page';

const state = vi.hoisted(() => ({ post: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: state.push }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/axios', () => ({ default: { post: state.post } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'fixture-user' }, refreshSession: vi.fn() }) }));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    isLoading: false,
    profile: {
      id: 'fixture-user',
      userProfile: { dietaryPreference: 'OMNIVORE', ricePreference: 'FLEXIBLE', foodCulture: 'Filipino' },
    },
  }),
}));

describe('onboarding preferences without location collection', () => {
  it('saves preferences and proceeds without requesting or submitting region/city', async () => {
    state.post.mockResolvedValue({ data: { success: true } });
    render(<PreferencesPage />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByText('Meal-planning location')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Continue to Step 3/ }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/onboarding/conditions'));
    expect(state.post).toHaveBeenCalledWith('/user/onboarding/profile', {
      dietaryPreference: 'OMNIVORE',
      ricePreference: 'FLEXIBLE',
      foodCulture: 'Filipino',
    });
  });
});

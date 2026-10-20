import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import AdminProfilePage from './page';
const session = vi.hoisted(() => ({
  user: { role: 'ADMIN', name: 'Admin', email: 'fixture@example.invalid' },
  logout: vi.fn(),
  updateUserSession: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => session }));
vi.mock('@/lib/axios', () => ({ default: { put: vi.fn() } }));
vi.mock('@/features/profile/AvatarSettings', () => ({ default: () => null }));
beforeEach(() => vi.clearAllMocks());
it('changes the admin’s own password and clears the session when sign-in is required', async () => {
  vi.mocked(api.put).mockResolvedValue({ data: { success: true, data: { requiresSignIn: true } } });
  render(<AdminProfilePage />);
  fireEvent.change(screen.getByLabelText('Current Password', { exact: true }), { target: { value: 'Current123!' } });
  fireEvent.change(screen.getByLabelText('New Password', { exact: true }), { target: { value: 'Replacement123!' } });
  fireEvent.change(screen.getByLabelText('Confirm New Password', { exact: true }), {
    target: { value: 'Replacement123!' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
  await waitFor(() => expect(session.logout).toHaveBeenCalledTimes(1));
  expect(api.put).toHaveBeenCalledWith('/user/profile/settings', {
    currentPassword: 'Current123!',
    newPassword: 'Replacement123!',
  });
});

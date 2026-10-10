import { StrictMode } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AdminNutritionistsPage from '@/features/admin-nutritionists/AdminNutritionistsPanel';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import api from '@/lib/axios';
import type { NutritionistApplication } from './model';

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'strict-admin' } }) }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(async () => ({ data: { success: true, data: [] } })) } }));
beforeEach(() => {
  clearSessionResourceCache();
  vi.mocked(api.get)
    .mockReset()
    .mockResolvedValue({ data: { success: true, data: [] } });
});
it('finishes initial governance loading after React Strict Mode cleans up and restarts effects', async () => {
  render(
    <StrictMode>
      <AdminNutritionistsPage />
    </StrictMode>
  );
  expect(await screen.findByText('No active applications.')).toBeInTheDocument();
  expect(screen.queryByText('Loading professional governance records...')).not.toBeInTheDocument();
});

it('opens application actions from the shared list without bypassing verification requirements', async () => {
  const application: NutritionistApplication = {
    id: 'synthetic-table-application',
    referenceCode: 'TEST-ONLY',
    status: 'CALL_SCHEDULED',
    fullName: 'Synthetic Applicant',
    email: 'applicant@example.invalid',
    phoneNumber: '+63 917 555 0123',
    prcLicenseNumber: 'TEST-ONLY',
    prcLicenseExpiry: '2030-01-01',
    specialization: 'Nutrition',
    yearsOfExperience: 1,
    university: 'Synthetic University',
    professionalBio: 'Synthetic fixture.',
    availableCallSlots: [],
    scheduledCallAt: '2030-01-01T00:00:00Z',
    meetingUrl: 'https://meet.google.com/test-only',
    createdAt: '2026-10-03',
  };
  vi.mocked(api.get).mockImplementation(async (path) => ({
    data: { success: true, data: String(path).endsWith('/nutritionist-applications') ? [application] : [] },
  }));
  render(<AdminNutritionistsPage />);
  const table = await screen.findByRole('table', { name: 'Active pipeline' });
  expect(within(table).getByText('Synthetic Applicant')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Approve verified applicant' })).not.toBeInTheDocument();
  fireEvent.click(within(table).getByRole('button', { name: 'Review application' }));
  expect(screen.getByRole('button', { name: 'Approve verified applicant' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Resend meeting email' })).toBeEnabled();
  fireEvent.click(within(table).getByRole('button', { name: 'Close details' }));
  expect(screen.queryByRole('button', { name: 'Approve verified applicant' })).not.toBeInTheDocument();
});

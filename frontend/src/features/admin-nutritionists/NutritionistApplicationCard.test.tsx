import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { NutritionistApplicationCard } from './NutritionistApplicationCard';
import type { ApplicationActionResponse, NutritionistApplication } from './model';
const api = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: api }));
const application: NutritionistApplication = {
  id: 'synthetic-application',
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
beforeEach(() => vi.clearAllMocks());
for (const delivered of [true, false]) {
  it(`offers one meeting reminder and reports confirmed delivery ${delivered}`, async () => {
    const notices: string[] = [];
    api.post.mockResolvedValue({ data: { data: { callEmailSent: delivered } } });
    const onAction = async (
      _id: string,
      request: () => Promise<ApplicationActionResponse>,
      message: string | ((result: ApplicationActionResponse) => string)
    ) => {
      const result = await request();
      notices.push(typeof message === 'function' ? message(result) : message);
    };
    render(
      <NutritionistApplicationCard
        application={application}
        onAction={onAction}
        onRejectionReasonChange={vi.fn()}
        onScheduleChange={vi.fn()}
        rejectionReason=""
        workingId={null}
      />
    );
    expect(screen.getAllByRole('button', { name: 'Resend meeting email' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Approve verified applicant' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Resend meeting email' }));
    await waitFor(() => expect(notices).toHaveLength(1));
    expect(api.post).toHaveBeenCalledWith('/admin/nutritionist-applications/synthetic-application/resend-call-email');
    expect(notices[0]).toBe(
      delivered
        ? 'Meeting reminder email sent.'
        : 'Email delivery was not confirmed. Check email configuration and retry shortly.'
    );
  });
}

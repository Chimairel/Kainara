import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClinicalEvidenceWorkspace from './ClinicalEvidenceWorkspace';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), push: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }), useSearchParams: () => new URLSearchParams() }));

describe('optional onboarding clinical document', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: { data: {
      consentVersion: 'CLINICAL_DOCUMENT_UPLOAD_V1', requirements: [], availableAreas: ['HEART_CONDITION'],
      documents: [], contexts: [],
    } } });
    mocks.post.mockResolvedValue({ data: { success: true } });
  });

  it('lets the user skip an upload or provide a document before food safety', async () => {
    render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    expect(await screen.findByRole('heading', { name: 'Supporting health documents (optional)' })).toBeInTheDocument();
    expect(mocks.get).toHaveBeenCalledWith('/user/onboarding/clinical-evidence');
    expect(screen.getByRole('button', { name: 'Continue to food safety' })).toBeEnabled();

    fireEvent.change(screen.getByLabelText('Choose file'), { target: { files: [new File(['report'], 'report.pdf', { type: 'application/pdf' })] } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.submit(screen.getByRole('button', { name: 'Upload privately' }).closest('form')!);
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith(
      '/user/onboarding/clinical-evidence/documents', expect.any(FormData), expect.any(Object)
    ));
    const form = mocks.post.mock.calls[0][1] as FormData;
    expect(form.get('area')).toBe('HEART_CONDITION');
    expect(form.get('consentAccepted')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Continue to food safety' }));
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/allergies');
  });

  it('shows the nutritionist document request and its note in the profile upload page', async () => {
    mocks.get.mockImplementation((path: string) => Promise.resolve({ data: { data:
      path === '/user/clinical-profile-review/status'
        ? { required: true, approved: false, documentRequest: { area: 'HEART_CONDITION', notes: 'Please provide a recent heart report.' } }
        : { consentVersion: 'CLINICAL_DOCUMENT_UPLOAD_V1', requirements: [], availableAreas: ['HEART_CONDITION'], documents: [], contexts: [] },
    } }));
    render(<ClinicalEvidenceWorkspace />);
    expect(await screen.findByText('Please provide a recent heart report.')).toBeInTheDocument();
    expect(screen.getByText(/profile remains unconfirmed/)).toBeInTheDocument();
  });
});

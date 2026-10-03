import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClinicalEvidenceWorkspace from './ClinicalEvidenceWorkspace';
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), push: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'fixture' } }) }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(),
}));
const workspace = { safetyRevision: 2, availableAreas: ['HEART_CONDITION'], requirements: [], contexts: [] };
describe('health details form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: { data: workspace } });
    mocks.put.mockResolvedValue({ data: { data: workspace } });
  });
  it('saves structured user-provided details without uploading files', async () => {
    const { container } = render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    await screen.findByLabelText('Condition or restriction details');
    expect(container.querySelector('input[type="file"]')).toBeNull();
    for (const label of [
      'Condition or restriction details',
      'Current medication or supplements',
      'Dietary advice you have received',
      'Recent symptoms or episodes',
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'Unknown details for review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save health details' }));
    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith(
        '/user/onboarding/clinical-evidence/details',
        expect.objectContaining({
          area: 'HEART_CONDITION',
          expectedSafetyRevision: 2,
          medications: 'Unknown details for review',
        })
      )
    );
    expect(await screen.findByText(/Health details saved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to food safety' }));
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/allergies');
  });
  it('shows a nutritionist request and restores saved answers', async () => {
    mocks.get.mockImplementation((path: string) =>
      Promise.resolve({
        data: {
          data: path.endsWith('/status')
            ? { detailsRequest: { area: 'HEART_CONDITION', notes: 'Please describe your current medication.' } }
            : {
                ...workspace,
                contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'Known heart condition' } }],
              },
        },
      })
    );
    render(<ClinicalEvidenceWorkspace />);
    expect(await screen.findByText('Please describe your current medication.')).toBeInTheDocument();
    expect(screen.getByLabelText('Condition or restriction details')).toHaveValue('Known heart condition');
  });
  it('leaves the form available and shows a failed save', async () => {
    mocks.put.mockRejectedValue(new Error('Unavailable'));
    render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    fireEvent.submit((await screen.findByRole('button', { name: 'Save health details' })).closest('form')!);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save health details' })).toBeEnabled();
  });
});

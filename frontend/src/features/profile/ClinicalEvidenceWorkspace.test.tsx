import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClinicalEvidenceWorkspace from './ClinicalEvidenceWorkspace';
const mocks = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn(), push: vi.fn(), search: '' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'fixture' } }) }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
const workspace = { safetyRevision: 2, availableAreas: ['HEART_CONDITION'], requirements: [], contexts: [] };
describe('health details form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = '';
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
    fireEvent.click(screen.getByRole('button', { name: 'Continue to shopping day' }));
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/shopping-day');
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
  it('opens the missing allergy form first and never copies condition answers into it', async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...workspace,
          availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
          requirements: [
            { area: 'HEART_CONDITION', state: 'READY', message: 'Heart details available.' },
            { area: 'FOOD_ALLERGY', state: 'CONTEXT_REQUIRED', message: 'Allergy details needed.' },
          ],
          contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'Saved heart condition details' } }],
        },
      },
    });
    render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    expect(await screen.findByLabelText('Related condition or restriction')).toHaveValue('FOOD_ALLERGY');
    expect(screen.getByText('1 of 2 health detail forms complete.')).toBeInTheDocument();
    expect(screen.getByLabelText('Condition or restriction details')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Continue to shopping day' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Related condition or restriction'), {
      target: { value: 'HEART_CONDITION' },
    });
    expect(screen.getByLabelText('Condition or restriction details')).toHaveValue('Saved heart condition details');
    fireEvent.click(screen.getByRole('button', { name: 'Complete food allergy details' }));
    expect(screen.getByLabelText('Condition or restriction details')).toHaveValue('');
  });

  it('keeps a requested area selected and shows the remaining form after saving it', async () => {
    const multiple = {
      ...workspace,
      availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
      requirements: ['HEART_CONDITION', 'FOOD_ALLERGY'].map((area) => ({
        area,
        state: 'CONTEXT_REQUIRED',
        message: 'Details needed.',
      })),
    };
    mocks.get.mockImplementation((path: string) =>
      Promise.resolve({
        data: {
          data: path.endsWith('/status')
            ? { detailsRequest: { area: 'HEART_CONDITION', notes: 'Please complete heart details.' } }
            : multiple,
        },
      })
    );
    mocks.put.mockResolvedValue({
      data: {
        data: {
          ...multiple,
          requirements: [{ ...multiple.requirements[0], state: 'READY' }, multiple.requirements[1]],
          contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'Saved heart condition details' } }],
        },
      },
    });
    render(<ClinicalEvidenceWorkspace />);
    expect(await screen.findByLabelText('Related condition or restriction')).toHaveValue('HEART_CONDITION');
    fireEvent.submit(screen.getByRole('button', { name: 'Save health details' }).closest('form')!);
    expect(await screen.findByText('1 of 2 health detail forms complete.')).toBeInTheDocument();
    expect(screen.getByText('Still needed: food allergy.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete food allergy details' }));
    expect(screen.getByLabelText('Related condition or restriction')).toHaveValue('FOOD_ALLERGY');
    expect(screen.getByLabelText('Condition or restriction details')).toHaveValue('');
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.put.mock.calls[0][1]).toMatchObject({ area: 'HEART_CONDITION', expectedSafetyRevision: 2 });
  });
  it('returns completed review edits to the review screen, without changing normal onboarding order', async () => {
    mocks.search = 'from=review';
    render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    const continueButton = await screen.findByRole('button', { name: 'Return to review' });
    expect(continueButton).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Back to review' })).toHaveAttribute('href', '/onboarding/tos');
    fireEvent.click(continueButton);
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/tos');
  });
});

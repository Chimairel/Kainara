import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';
import api from '@/lib/axios';
import MealVerificationPanel from '@/app/(nutritionist)/nutritionist/reviews/MealVerificationPanel';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'feedback-test-rnd' } }) }));
vi.mock('./BaseMealEvidenceSheets', () => ({ default: () => <p>Saved recipe evidence</p> }));
vi.mock('./RndQueueDocument', () => ({
  default: ({ children, tools, actions }: { children: ReactNode; tools: ReactNode; actions: ReactNode }) =>
    <section aria-label="Verification canvas">{actions}{tools}{children}</section>,
  ReviewDocumentPage: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [{
    id: 'recipe', kind: 'RAW_RECIPE', revisionKey: 'version', name: 'Synthetic recipe',
    mealType: 'LUNCH', source: 'SOURCE', status: 'PENDING', claimedByMe: true, claimedByOther: false,
  }] } });
});

it.each(['approve', 'reject'] as const)('closes verification and confirms a saved %s even when queue refresh fails', async action => {
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  render(<MealVerificationPanel />);
  fireEvent.click(await screen.findByRole('button', { name: /Synthetic recipe/ }));
  fireEvent.click(screen.getByRole('button', { name: action === 'approve' ? 'Approve' : 'Reject', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: action === 'approve' ? 'Review rationale' : 'Rejection reason' }), {
    target: { value: 'Recorded verification rationale.' },
  });
  vi.mocked(api.get).mockRejectedValue(new Error('Queue refresh failed'));
  fireEvent.click(screen.getByRole('button', { name: action === 'approve' ? 'Verify base meal' : 'Confirm rejection', exact: true }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Verification canvas' })).not.toBeInTheDocument());
  expect(screen.getByRole('heading', { name: 'A clear path to meal verification' })).toBeVisible();
  expect(api.post).toHaveBeenCalledWith('/nutritionist/meal-verification/RAW_RECIPE/recipe/decision', {
    decision: action === 'approve' ? 'VERIFIED' : 'REJECTED', rationale: 'Recorded verification rationale.',
  });
  expect(toast.success).toHaveBeenCalledExactlyOnceWith(action === 'approve' ? 'Meal verified' : 'Meal rejected');
});

it('keeps a failed verification open with its rationale and no success toast', async () => {
  vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'The claim expired.' } } });
  render(<MealVerificationPanel />);
  fireEvent.click(await screen.findByRole('button', { name: /Synthetic recipe/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Approve', exact: true }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Review rationale' }), { target: { value: 'Recorded verification rationale.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify base meal', exact: true }));
  await within(screen.getByRole('region', { name: 'Verification canvas' })).findByText('The claim expired.');
  expect(screen.getByRole('region', { name: 'Verification canvas' })).toBeVisible();
  expect(screen.getByRole('textbox', { name: 'Review rationale' })).toHaveValue('Recorded verification rationale.');
  expect(toast.success).not.toHaveBeenCalled();
});

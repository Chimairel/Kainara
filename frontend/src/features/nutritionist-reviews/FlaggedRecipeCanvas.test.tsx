import type { ReactNode, ButtonHTMLAttributes } from 'react';
import type { LibraryMeal } from '@/features/nutritionist-library/useNutritionistLibrary';
import type { ReviewCase } from '@/features/nutritionist-library/MealReviewPanel';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import FlaggedRecipeCanvas from './FlaggedRecipeCanvas';

const mocks = vi.hoisted(() => ({ data: {} as { meal: LibraryMeal; review: ReviewCase }, post: vi.fn(), refetch: vi.fn(), success: vi.fn(), complete: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'rnd' } }) }));
vi.mock('@/hooks/useSessionQuery', () => ({ useSessionQuery: () => ({ data: mocks.data, refetch: mocks.refetch }) }));
vi.mock('@/lib/axios', () => ({ default: { post: mocks.post } }));
vi.mock('sonner', () => ({ toast: { success: mocks.success } }));
vi.mock('./BaseMealEvidenceSheets', () => ({ default: () => <div>Recorded recipe evidence</div> }));
vi.mock('./CanvasToolButton', () => ({ default: (props: ButtonHTMLAttributes<HTMLButtonElement>) => <button type="button" {...props} /> }));
vi.mock('./RndQueueDocument', () => ({
  default: ({ actions, tools, children }: { actions: ReactNode; tools: ReactNode; children: ReactNode }) => <div>{actions}{tools}{children}</div>,
  ReviewDocumentPage: ({ children, title }: { children: ReactNode; title: string }) => <article aria-label={title}>{children}</article>,
}));
const props = { mealId: 'recipe', expanded: false, onExpandedChange: vi.fn(), onBack: vi.fn(), onComplete: mocks.complete };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.data = { meal: { id: 'recipe', mealName: 'Synthetic soup' }, review: {
    recipeVersion: 'recipe-version', reviewVersion: 'review-version', state: 'PENDING_REREVIEW',
    claimStatus: { claimedByMe: true }, incident: { reports: ['first', 'second'].map(id => ({ id, notes: { explanation: `Concern ${id}` } })) },
  } } as unknown as { meal: LibraryMeal; review: ReviewCase };
  mocks.post.mockResolvedValue({ data: { success: true } });
  mocks.refetch.mockResolvedValue(mocks.data);
  mocks.complete.mockResolvedValue(undefined);
});

it('keeps evidence readable but prevents involved RNDs and unclaimed reviews from deciding', () => {
  mocks.data.review.claimStatus = { claimedByMe: false, claimedByOther: false, reviewerInvolved: true };
  render(<FlaggedRecipeCanvas {...props} />);
  expect(screen.getByText('Recorded recipe evidence')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Independent RND needed' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
  expect(mocks.post).not.toHaveBeenCalled();
});

it('requires a marked resolution for every concern; edits invalidate the mark and failed saves retain notes', async () => {
  render(<FlaggedRecipeCanvas {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  const notes = screen.getAllByLabelText('How you resolved this concern');
  notes.forEach(note => fireEvent.change(note, { target: { value: 'Reconciled measured ingredients against recorded source.' } }));
  fireEvent.change(screen.getByLabelText('Review rationale'), { target: { value: 'Reviewed every recorded concern and measured serving.' } });
  fireEvent.click(screen.getByLabelText(/I reviewed the nutrition evidence/));
  const confirm = screen.getByRole('button', { name: 'Verify base meal' });
  const marks = screen.getAllByRole('button', { name: 'Mark resolved' });
  fireEvent.click(marks[0]); expect(confirm).toBeDisabled();
  fireEvent.click(marks[1]); expect(confirm).toBeEnabled();
  expect(mocks.post).not.toHaveBeenCalled();
  fireEvent.change(notes[0], { target: { value: 'Updated the source reconciliation for this concern.' } });
  expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
  mocks.post.mockRejectedValueOnce({ response: { data: { error: 'Recipe changed. Refresh first.' } } });
  fireEvent.click(confirm);
  await screen.findAllByText('Recipe changed. Refresh first.');
  expect(notes[0]).toHaveValue('Updated the source reconciliation for this concern.');
  expect(mocks.complete).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  await waitFor(() => expect(mocks.complete).toHaveBeenCalledOnce());
  expect(mocks.post).toHaveBeenLastCalledWith('/nutritionist/meal-review-cases/recipe/confirm', expect.objectContaining({
    expectedVersion: 'review-version', evidenceReviewed: true, riceRoleReviewed: true,
    resolutions: [{ reportId: 'first', rationale: 'Updated the source reconciliation for this concern.' }, { reportId: 'second', rationale: 'Reconciled measured ingredients against recorded source.' }],
  }));
  expect(mocks.success).toHaveBeenCalledWith('Meal verified');
});

it('records rejection on a reasoning page then returns to the queue', async () => {
  render(<FlaggedRecipeCanvas {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Reject' }));
  fireEvent.change(screen.getByLabelText('Rejection reason'), { target: { value: 'Measured quantities still need correction before publication.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Keep recipe withheld' }));
  await waitFor(() => expect(mocks.complete).toHaveBeenCalledOnce());
  expect(mocks.post).toHaveBeenCalledWith('/nutritionist/meal-review-cases/recipe/reject', { expectedVersion: 'review-version', rationale: 'Measured quantities still need correction before publication.' });
});

it('invalidates the decision draft when evidence changes or the claim is lost', () => {
  const { rerender } = render(<FlaggedRecipeCanvas {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  fireEvent.change(screen.getByLabelText('Review rationale'), { target: { value: 'A draft tied to the previous evidence version.' } });
  mocks.data.review.reviewVersion = 'changed-version';
  rerender(<FlaggedRecipeCanvas {...props} />);
  expect(screen.queryByLabelText('Review rationale')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
  expect(screen.getByLabelText('Review rationale')).toHaveValue('');
  mocks.data.review.claimStatus = { claimedByMe: false, claimedByOther: true };
  rerender(<FlaggedRecipeCanvas {...props} />);
  expect(screen.queryByLabelText('Review rationale')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Being reviewed' })).toBeDisabled();
});

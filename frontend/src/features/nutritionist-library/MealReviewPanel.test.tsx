vi.mock('@/features/nutritionist-reviews/useFlagDraft', async () => ({ useFlagDraft: (await import('@/test-utils/flag-draft-mock')).useFlagDraftMock }));
import { ThemeProvider } from '@/lib/context/ThemeContext';
import type { ComponentProps } from 'react';
import { fireEvent, render as renderUi, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import MealReviewPanel from './MealReviewPanel';

const render = (ui: Parameters<typeof renderUi>[0]) => renderUi(ui, { wrapper: ThemeProvider });

const fixture = vi.hoisted(() => ({ data: {} as Record<string, unknown>, post: vi.fn(), refetch: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: fixture.success, error: fixture.error, warning: fixture.warning } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'independent-rnd' } }) }));
vi.mock('@/hooks/useSessionQuery', () => ({
  useSessionQuery: () => ({ data: fixture.data, refetch: fixture.refetch }),
}));
vi.mock('@/lib/axios', () => ({ default: { post: fixture.post } }));
vi.mock('./MealReviewTimeline', () => ({ default: () => null, reviewStateLabel: (value: string) => value }));

const report = (id: string) => ({ id, notes: { category: 'NUTRITION', explanation: `Recorded concern ${id}` } });
const meal = {
  id: 'recipe',
  mealName: 'Measured plate',
  calories: 400,
  proteinG: 20,
  carbsG: 60,
  fatG: 10,
  ingredients: [],
} as unknown as ComponentProps<typeof MealReviewPanel>['meal'];
beforeEach(() => {
  vi.clearAllMocks();
  fixture.data = {
    state: 'PENDING_REREVIEW',
    reviewVersion: 'a'.repeat(64),
    incident: { reports: [report('first'), report('second')], decisions: [], confirmations: [] },
    history: [],
    claimStatus: { claimedByMe: true, claimedByOther: false },
  };
  fixture.post.mockResolvedValue({ data: { success: true } });
  fixture.refetch.mockResolvedValue(fixture.data);
});

it('an involved verifier cannot claim or edit concern resolutions', () => {
  fixture.data = { ...fixture.data, claimStatus: { claimedByMe: false, claimedByOther: false, reviewerInvolved: true } };
  render(<MealReviewPanel meal={meal} isAdmin={false} refresh={vi.fn()} />);
  const claim = screen.getByRole('button', { name: 'Claim re-review' });
  expect(claim).toBeDisabled();
  fireEvent.click(claim);
  expect(fixture.post).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('How you resolved this concern')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Re-verify recipe' })).toBeDisabled();
});

it('every flag requires its own marked resolution; edits invalidate the mark', async () => {
  render(<MealReviewPanel meal={meal} isAdmin={false} refresh={vi.fn().mockResolvedValue(undefined)} />);
  expect(screen.queryByLabelText('How you resolved this concern')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resolve concerns' }));
  const notes = screen.getAllByLabelText('How you resolved this concern');
  notes.forEach((note) =>
    fireEvent.change(note, { target: { value: 'Reconciled the ingredient grams against the recorded source.' } })
  );
  fireEvent.change(screen.getByLabelText('Independent review findings'), {
    target: { value: 'Checked all evidence and the recorded serving variants.' },
  });
  fireEvent.click(screen.getByLabelText(/I reviewed the nutrition evidence/));
  const verify = screen.getByRole('button', { name: 'Re-verify recipe' });
  const marks = screen.getAllByRole('button', { name: 'Mark resolved' });
  fireEvent.click(marks[0]);
  expect(verify).toBeDisabled();
  fireEvent.click(marks[1]);
  expect(verify).toBeEnabled();
  fireEvent.change(notes[0], { target: { value: 'Checked the new source and reconciled the measured grams.' } });
  expect(verify).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
  fireEvent.click(verify);
  await waitFor(() => expect(fixture.post).toHaveBeenCalledOnce());
  expect(fixture.post.mock.calls[0][1].resolutions).toEqual([
    { reportId: 'first', rationale: 'Checked the new source and reconciled the measured grams.' },
    { reportId: 'second', rationale: 'Reconciled the ingredient grams against the recorded source.' },
  ]);
  await waitFor(() => expect(verify).toBeDisabled());
});

it('changed review evidence clears drafts and losing the claim removes resolution editing', () => {
  const { rerender } = render(<MealReviewPanel meal={meal} isAdmin={false} refresh={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Resolve concerns' }));
  fireEvent.change(screen.getAllByLabelText('How you resolved this concern')[0], {
    target: { value: 'Reconciled the ingredient grams against the recorded source.' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'Mark resolved' })[0]);
  fixture.data = { ...fixture.data, reviewVersion: 'b'.repeat(64) };
  rerender(<MealReviewPanel meal={meal} isAdmin={false} refresh={vi.fn()} />);
  expect(screen.queryByLabelText('How you resolved this concern')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Resolve concerns' }));
  expect(screen.getAllByLabelText('How you resolved this concern')[0]).toHaveValue('');
  expect(screen.queryByRole('button', { name: 'Resolved for this review' })).not.toBeInTheDocument();
  fixture.data = { ...fixture.data, claimStatus: { claimedByMe: false, claimedByOther: true } };
  rerender(<MealReviewPanel meal={meal} isAdmin={false} refresh={vi.fn()} />);
  expect(screen.queryByLabelText('How you resolved this concern')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Re-verify recipe' })).toBeDisabled();
});


it('opens a verification canvas, removes cancelled flag pages and retains failed submission drafts', async () => {
  fixture.data = { ...fixture.data, state: 'PUBLISHED', recipeVersion: 'c'.repeat(64), incident: null };
  render(<MealReviewPanel meal={meal} isAdmin={false} refresh={vi.fn()} />);
  expect(screen.queryByLabelText('Explanation')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  expect(screen.getByRole('dialog', { name: /Meal verification.*fullscreen/ })).toBeVisible();
  expect(screen.getByRole('article', { name: 'Base meal verification' })).toBeVisible();
  expect(screen.getByRole('article', { name: 'Recipe ingredients' })).toBeVisible();
  expect(screen.queryByRole('article', { name: 'Flag meal reasons' })).not.toBeInTheDocument();
  expect(fixture.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Flag meal' }));
  expect(screen.getByRole('article', { name: 'Flag meal reasons' })).toBeVisible();
  fireEvent.change(screen.getByLabelText('Explanation'), { target: { value: 'Measured nutrients do not match the ingredient evidence.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('article', { name: 'Flag meal reasons' })).not.toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Flag meal' }).at(-1)!);
  expect(screen.getByLabelText('Explanation')).toHaveValue('');
  fireEvent.change(screen.getByLabelText('Explanation'), { target: { value: 'Measured nutrients do not match the ingredient evidence.' } });
  const submit = screen.getByRole('button', { name: 'Flag and withhold meal' });
  expect(submit).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Affected ingredients or nutrition fields'), { target: { value: 'sodiumMg' } });
  fireEvent.change(screen.getByLabelText('Supporting evidence or reference'), { target: { value: 'Measured source reference.' } });
  fireEvent.change(screen.getByLabelText('Proposed correction'), { target: { value: 'Recheck measured food amounts.' } });
  fixture.post.mockRejectedValueOnce({ response: { data: { error: 'The meal changed. Refresh first.' } } });
  fireEvent.click(submit);
  await waitFor(() => expect(fixture.error).toHaveBeenCalledWith('The meal changed. Refresh first.'));
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByLabelText('Explanation')).not.toHaveValue('');
  fixture.post.mockResolvedValueOnce({ data: { success: true } });
  fireEvent.click(submit);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(fixture.success).toHaveBeenCalledWith('Meal flagged for review.');
  expect(fixture.post).toHaveBeenLastCalledWith('/nutritionist/library/recipe/flag', expect.objectContaining({ expectedVersion: 'c'.repeat(64), notes: expect.objectContaining({ affectedFields: ['sodiumMg'] }) }));
});

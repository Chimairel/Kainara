import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import MealReviewPanel from './MealReviewPanel';

const fixture = vi.hoisted(() => ({ data: {} as Record<string, unknown>, post: vi.fn(), refetch: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'independent-rnd' } }) }));
vi.mock('@/hooks/useSessionQuery', () => ({
  useSessionQuery: () => ({ data: fixture.data, refetch: fixture.refetch }),
}));
vi.mock('@/lib/axios', () => ({ default: { post: fixture.post } }));
vi.mock('./RecipeDerivationForm', () => ({ default: () => null }));
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

it('every flag requires its own marked resolution; edits invalidate the mark', async () => {
  render(<MealReviewPanel meal={meal} isAdmin={false} refresh={vi.fn().mockResolvedValue(undefined)} />);
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
  fireEvent.change(screen.getAllByLabelText('How you resolved this concern')[0], {
    target: { value: 'Reconciled the ingredient grams against the recorded source.' },
  });
  fireEvent.click(screen.getAllByRole('button', { name: 'Mark resolved' })[0]);
  fixture.data = { ...fixture.data, reviewVersion: 'b'.repeat(64) };
  rerender(<MealReviewPanel meal={meal} isAdmin={false} refresh={vi.fn()} />);
  expect(screen.getAllByLabelText('How you resolved this concern')[0]).toHaveValue('');
  expect(screen.queryByRole('button', { name: 'Resolved for this review' })).not.toBeInTheDocument();
  fixture.data = { ...fixture.data, claimStatus: { claimedByMe: false, claimedByOther: true } };
  rerender(<MealReviewPanel meal={meal} isAdmin={false} refresh={vi.fn()} />);
  expect(screen.queryByLabelText('How you resolved this concern')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Re-verify recipe' })).toBeDisabled();
});

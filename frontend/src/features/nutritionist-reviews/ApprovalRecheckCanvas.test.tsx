import { ThemeProvider } from '@/lib/context/ThemeContext';
import { fireEvent, render as renderUi, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ApprovalRecheckCanvas from './ApprovalRecheckCanvas';
const render = (ui: Parameters<typeof renderUi>[0]) => renderUi(ui, { wrapper: ThemeProvider });
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: api }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'independent-rnd' } }) }));
const target = { kind: 'PROFILE' as const, mealLibraryId: 'recipe', approvalId: 'flag' };
const detail = () => ({
  meal: { mealName: 'Recorded plate', calories: 400, proteinG: 20, carbsG: 60, fatG: 10, ingredients: [] },
  originatingPlan: null,
  flagReview: {
    expectedVersion: 'a'.repeat(64),
    state: 'FLAGGED',
    canResolve: true,
    blockedByRecipe: false,
    matchesCurrentRecipe: true,
    concern: {
      id: 'flag',
      notes: {
        explanation: 'Check the measured sodium values in this recorded plate.',
        reference: 'Recorded reference evidence.',
      },
    },
  },
});
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: detail() } });
  api.post.mockResolvedValue({ data: { success: true } });
});
it('rejects incomplete approval evidence and retries without exposing decision controls', async () => {
  api.get.mockResolvedValueOnce({ data: { data: { meal: { mealName: 'Incomplete plate' } } } });
  render(<ApprovalRecheckCanvas target={target} onVerified={vi.fn()} onClose={vi.fn()} />);
  await screen.findByText('Approval evidence could not be loaded.');
  expect(screen.getByRole('button', { name: 'Verify resolved case' })).toBeDisabled();
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Reload evidence' }));
  await screen.findByText('Check the measured sodium values in this recorded plate.');
});
it('requires a written resolution and explicit mark before verification, then saves the exact version', async () => {
  const onVerified = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<ApprovalRecheckCanvas target={target} onVerified={onVerified} onClose={onClose} />);
  expect(screen.queryByLabelText('How you resolved this concern')).not.toBeInTheDocument();
  await screen.findByText('Check the measured sodium values in this recorded plate.');
  fireEvent.click(screen.getByRole('button', { name: 'Resolve concern' }));
  const note = screen.getByLabelText('How you resolved this concern');
  const verify = screen.getByRole('button', { name: 'Verify resolved case' });
  expect(verify).toBeDisabled();
  fireEvent.change(note, { target: { value: 'Checked the source and corrected the recorded measured quantity.' } });
  expect(verify).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
  expect(verify).toBeEnabled();
  fireEvent.change(note, { target: { value: 'Checked the current food source and measured ingredient evidence.' } });
  expect(verify).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
  fireEvent.click(verify);
  await waitFor(() => expect(onVerified).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledWith('/nutritionist/library/recipe/approvals/flag/recheck', {
    kind: 'PROFILE',
    rationale: 'Checked the current food source and measured ingredient evidence.',
    expectedVersion: 'a'.repeat(64),
    resolved: true,
  });
  expect(onClose).toHaveBeenCalledOnce();
});
it('stale submission clears the resolution mark and cannot automatically submit twice', async () => {
  api.post.mockRejectedValue({
    response: { data: { error: 'The approval or flag changed. Reload its current evidence.' } },
  });
  const onVerified = vi.fn();
  render(<ApprovalRecheckCanvas target={target} onVerified={onVerified} onClose={vi.fn()} />);
  await screen.findByText('Check the measured sodium values in this recorded plate.');
  fireEvent.click(screen.getByRole('button', { name: 'Resolve concern' }));
  fireEvent.change(screen.getByLabelText('How you resolved this concern'), {
    target: { value: 'Checked the measured ingredient quantities against the source.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
  fireEvent.click(screen.getByRole('button', { name: 'Verify resolved case' }));
  await screen.findByText('The approval or flag changed. Reload its current evidence.');
  expect(screen.getByRole('button', { name: 'Verify resolved case' })).toBeDisabled();
  expect(api.post).toHaveBeenCalledOnce();
  expect(onVerified).not.toHaveBeenCalled();
});
it('an involved reviewer or held recipe has no resolution editor or verification action', async () => {
  const held = detail();
  held.flagReview.canResolve = false;
  api.get.mockResolvedValue({ data: { data: held } });
  render(<ApprovalRecheckCanvas target={target} onVerified={vi.fn()} onClose={vi.fn()} />);
  await screen.findByText(/An uninvolved RND is required/);
  expect(screen.queryByLabelText('How you resolved this concern')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Verify resolved case' })).toBeDisabled();
});

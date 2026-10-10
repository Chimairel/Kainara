import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import MemberClarifications from './MemberClarifications';
import type { ClarificationWorkspace } from './types';
const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
const workspace: ClarificationWorkspace = {
  enabled: true,
  forms: [
    {
      id: 'form',
      title: 'Recorded question',
      authorName: 'Reviewer',
      createdAt: '2026-10-10',
      profileRevision: 2,
      scopeKey: 'scope',
      status: 'AWAITING_MEMBER',
      questions: [{ id: 'q', label: 'Your details', type: 'TEXT', required: true }],
      responses: [],
      resolution: null,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockResolvedValue({ data: { success: true } });
});
it('retries a failed refresh without reposting recorded answers or claiming the submission failed', async () => {
  const updated = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined);
  render(<MemberClarifications workspace={workspace} onUpdated={updated} />);
  fireEvent.change(screen.getByLabelText('Your details *'), { target: { value: 'Recorded answer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Answers were submitted');
  expect(screen.getByRole('button', { name: 'Submit answers' })).toBeDisabled();
  expect(screen.getByRole('status')).toHaveTextContent('Answers submitted');
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved answers' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(updated).toHaveBeenCalledTimes(2);
  expect(mocks.post).toHaveBeenCalledTimes(1);
});
it('keeps unsaved answers editable after a failed submission and reuses the retry key', async () => {
  mocks.post.mockRejectedValueOnce(new Error('Offline'));
  const updated = vi.fn().mockResolvedValue(undefined);
  render(<MemberClarifications workspace={workspace} onUpdated={updated} />);
  fireEvent.change(screen.getByLabelText('Your details *'), { target: { value: 'Recorded answer' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your answers could not be submitted');
  expect(screen.getByLabelText('Your details *')).toHaveValue('Recorded answer');
  expect(screen.queryByRole('button', { name: 'Reload saved answers' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
  await waitFor(() => expect(updated).toHaveBeenCalledOnce());
  expect(mocks.post.mock.calls[0][1].requestKey).toBe(mocks.post.mock.calls[1][1].requestKey);
});

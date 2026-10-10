import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import MemberProfileProposals from './MemberProfileProposals';
import type { ProfileProposalWorkspace } from './profile-proposal-types';
const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
const workspace: ProfileProposalWorkspace = {
  enabled: true,
  editableInputs: [],
  proposals: [
    {
      id: 'proposal',
      profileRevision: 2,
      scopeKey: 'scope',
      status: 'PENDING',
      authorName: 'Reviewer',
      createdAt: '2026-10-10',
      rationale: 'Recorded correction',
      beforeSnapshot: { safetyInputs: [], healthDetails: [] },
      changes: { domains: [], healthDetails: [] },
      evidenceSnapshot: [],
      memberNote: null,
      acceptedProfileRevision: null,
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockResolvedValue({ data: { success: true } });
});
it.each([
  ['Acknowledge and apply', true, 'Correction acknowledged and applied.'],
  ['Request correction', false, 'Correction request saved. Your profile is unchanged.'],
] as const)(
  'recovers a refresh failure after %s without submitting the response again',
  async (button, applied, message) => {
    const updated = vi.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValue(undefined);
    render(<MemberProfileProposals workspace={workspace} onUpdated={updated} />);
    fireEvent.change(screen.getByLabelText('Response or requested correction'), {
      target: { value: 'Please check this recorded value.' },
    });
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Your response was saved');
    expect(screen.getByRole('status')).toHaveTextContent(message);
    expect(screen.getByRole('button', { name: 'Acknowledge and apply' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved response' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(updated).toHaveBeenNthCalledWith(2, applied);
    expect(mocks.post).toHaveBeenCalledTimes(1);
  }
);
it('retains the response and retry key when the write itself fails', async () => {
  mocks.post.mockRejectedValueOnce(new Error('Offline'));
  const updated = vi.fn().mockResolvedValue(undefined);
  render(<MemberProfileProposals workspace={workspace} onUpdated={updated} />);
  fireEvent.change(screen.getByLabelText('Response or requested correction'), {
    target: { value: 'Please check this recorded value.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Request correction' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Your response could not be saved');
  expect(screen.getByLabelText('Response or requested correction')).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Request correction' }));
  await waitFor(() => expect(updated).toHaveBeenCalledOnce());
  expect(mocks.post.mock.calls[0][1].requestKey).toBe(mocks.post.mock.calls[1][1].requestKey);
});

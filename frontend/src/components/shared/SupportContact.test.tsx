import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import SupportContact from './SupportContact';

const state = vi.hoisted(() => ({ user: { userId: 'support-member', name: 'Test Member', email: 'member@example.invalid', emailVerified: true } as { userId: string; name: string; email: string; emailVerified: boolean } | null, post: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user, isLoading: false }) }));
vi.mock('@/lib/axios', () => ({ default: { post: state.post } }));
vi.mock('@/components/auth/AuthHeroPanel', () => ({ default: () => <span>Support scene</span> }));
vi.mock('@/components/auth/AuthMascot', () => ({ default: () => <span>Nara</span> }));

beforeEach(() => { state.user = { userId: 'support-member', name: 'Test Member', email: 'member@example.invalid', emailVerified: true }; state.post.mockReset(); });
const message = 'The grocery page did not let me update my shopping list.';

it('anonymous and unverified visitors see the full form but cannot send', () => {
  state.user = null; const { rerender } = render(<SupportContact />);
  expect(screen.getByLabelText('Your message')).toBeVisible();
  fireEvent.change(screen.getByLabelText('Your message'), { target: { value: message } });
  fireEvent.submit(screen.getByRole('button', { name: 'Send a support request' }).closest('form')!);
  expect(screen.getByRole('link', { name: /^Log in$/ })).toHaveAttribute('href', '/login');
  expect(screen.getByLabelText('Your message')).toHaveValue(message);
  state.user = { userId: 'unverified', name: 'Member', email: 'email@example.invalid', emailVerified: false }; rerender(<SupportContact />);
  fireEvent.submit(screen.getByRole('button', { name: 'Send a support request' }).closest('form')!);
  expect(screen.getByRole('link', { name: 'Verify email' })).toBeVisible(); expect(state.post).not.toHaveBeenCalled();
});

it('preserves the message after failure and confirms success only after provider acknowledgment', async () => {
  state.post.mockRejectedValueOnce(new Error('outage')).mockResolvedValueOnce({ data: { success: true, data: { status: 'RECORDED', reference: 'test-reference' } } });
  render(<SupportContact />);
  expect(screen.getByLabelText('Reply email')).toHaveValue('member@example.invalid');
  expect(screen.getByLabelText('Reply email')).not.toHaveAttribute('readonly');
  fireEvent.change(screen.getByLabelText('Reply email'), { target: { value: 'alternate@example.invalid' } });
  fireEvent.change(screen.getByLabelText('Your message'), { target: { value: message } });
  fireEvent.submit(screen.getByRole('button', { name: 'Send a support request' }).closest('form')!);
  await screen.findByRole('alert'); expect(screen.getByLabelText('Your message')).toHaveValue(message);
  fireEvent.submit(screen.getByRole('button', { name: 'Send a support request' }).closest('form')!);
  await screen.findByText('Support request received'); expect(screen.getByLabelText('Your message')).toHaveValue('');
  expect(state.post.mock.calls[0][1]).toMatchObject({ category: 'MEALS', message, replyEmail: 'alternate@example.invalid', requestKey: expect.any(String) });
});

it('prevents duplicate sends and aborts/reset drafts when the account changes', async () => {
  let finish: (value: unknown) => void = () => {};
  state.post.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const { rerender } = render(<SupportContact />);
  fireEvent.change(screen.getByLabelText('Your message'), { target: { value: message } });
  const form = screen.getByRole('button', { name: 'Send a support request' }).closest('form')!;
  fireEvent.submit(form); fireEvent.submit(form); expect(state.post).toHaveBeenCalledOnce();
  const signal = state.post.mock.calls[0][2].signal as AbortSignal;
  state.user = { userId: 'next', name: 'Next Member', email: 'next@example.invalid', emailVerified: true }; rerender(<SupportContact />);
  expect(signal.aborted).toBe(true); expect(screen.getByLabelText('Your message')).toHaveValue('');
  finish({ data: { success: true, data: { status: 'RECORDED', reference: 'old-reference' } } });
  await waitFor(() => expect(screen.queryByText('Support request received')).not.toBeInTheDocument());
});

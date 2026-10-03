import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ApplicantEmailVerification from './ApplicantEmailVerification';
const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/axios', () => ({ default: { post } }));
beforeEach(() => {
  post.mockReset();
});
it('sends and verifies a code for the entered address', async () => {
  const onVerified = vi.fn();
  post
    .mockResolvedValueOnce({ data: { data: { resendAfterSeconds: 60 } } })
    .mockResolvedValueOnce({ data: { data: { proof: 'private-proof' } } });
  render(<ApplicantEmailVerification email=" Person@example.com " verified={false} onVerified={onVerified} />);
  fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
  await waitFor(() => expect(onVerified).toHaveBeenCalledWith('person@example.com', 'private-proof'));
  expect(post).toHaveBeenCalledWith('/nutritionist-applications/email/verify', {
    email: 'person@example.com',
    code: '123456',
  });
});
it('ignores a verification response after the email was corrected', async () => {
  const onVerified = vi.fn();
  let finish!: (value: unknown) => void;
  post.mockResolvedValueOnce({ data: { data: {} } }).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { rerender } = render(
    <ApplicantEmailVerification email="mistyped@example.com" verified={false} onVerified={onVerified} />
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '123456' } });
  fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
  rerender(<ApplicantEmailVerification email="correct@example.com" verified={false} onVerified={onVerified} />);
  finish({ data: { data: { proof: 'wrong-address-proof' } } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Send verification code' })).toBeEnabled());
  expect(onVerified).not.toHaveBeenCalled();
});

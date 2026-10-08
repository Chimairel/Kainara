import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import ReviewAvailabilityPanel from './ReviewAvailabilityPanel';
import api from '@/lib/axios';

vi.mock('@/lib/axios', () => ({ default: { patch: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());

it('persists availability and displays verified zero years without granting self-declared expertise', async () => {
  vi.mocked(api.patch).mockResolvedValue({ data: { success: true, data: { acceptingReviews: true } } });
  render(<ReviewAvailabilityPanel verifiedExpertise={['HEART_CONDITION']} verifiedExperienceYears={0} />);
  const toggle = screen.getByRole('switch', { name: 'Accepting new reviews' });
  expect(toggle).toHaveAttribute('aria-checked', 'false');
  fireEvent.click(toggle);
  await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  expect(toggle).not.toBeDisabled();
  expect(api.patch).toHaveBeenCalledWith('/nutritionist/review-availability', { acceptingReviews: true });
  expect(screen.getByText('0 verified years of experience')).toBeInTheDocument();
  expect(
    screen.getByText('Editing your public specialization does not change specialist routing.')
  ).toBeInTheDocument();
});

it('keeps the prior availability when saving fails', async () => {
  vi.mocked(api.patch).mockRejectedValue(new Error('Unavailable'));
  render(<ReviewAvailabilityPanel acceptingReviews />);
  const toggle = screen.getByRole('switch', { name: 'Accepting new reviews' });
  fireEvent.click(toggle);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(toggle).toHaveAttribute('aria-checked', 'true');
  expect(toggle).not.toBeDisabled();
});

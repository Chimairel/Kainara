import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CheckinModal, { buildDirtyCheckinUpdates } from './CheckinModal';

const mocks = vi.hoisted(() => ({ post: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock('@/lib/axios', () => ({ default: { post: mocks.post } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ refreshSession: mocks.refresh }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.post.mockResolvedValue({ data: { success: true } });
  mocks.refresh.mockResolvedValue({});
});

describe('CheckinModal', () => {
  it('lets the user close without recording a response', () => {
    const onClose = vi.fn();
    render(<CheckinModal isOpen onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('submits an unchanged confirmation with the observed revision and opens the new report', async () => {
    const onClose = vi.fn();
    render(<CheckinModal isOpen onClose={onClose} profileRevision={7} />);
    fireEvent.click(screen.getByRole('button', { name: 'Still the same' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/profile/nutrition-report'));
    expect(mocks.post).toHaveBeenCalledWith('/user/checkin/submit', { changed: false, profileRevision: 7 });
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('does not label already saved changes as unchanged', async () => {
    render(<CheckinModal isOpen onClose={vi.fn()} profileRevision={8} hasPendingChanges />);
    expect(screen.queryByRole('button', { name: 'Still the same' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm my saved updates' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/user/checkin/submit', {
        changed: true,
        updates: {},
        profileRevision: 8,
      })
    );
  });
  it('submits only values that differ from the prefilled profile', () => {
    const initial = { weightKg: '70', activityLevel: 'ACTIVE', goal: 'MAINTAIN' };
    expect(buildDirtyCheckinUpdates(initial, { ...initial, goal: 'BUILD_MUSCLE' })).toEqual({
      goal: 'BUILD_MUSCLE',
    });
    expect(buildDirtyCheckinUpdates(initial, initial)).toEqual({});
  });
});

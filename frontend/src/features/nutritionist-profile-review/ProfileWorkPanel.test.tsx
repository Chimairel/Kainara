import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileWorkPanel from '@/app/(nutritionist)/nutritionist/reviews/ProfileWorkPanel';

const state = vi.hoisted(() => ({
  model: { detail: null as unknown, openingPersonId: null as string | null, error: null },
}));
vi.mock('./useProfileWorkPanelModel', () => ({ useProfileWorkPanelModel: () => state.model }));
vi.mock('./ProfileReviewQueue', () => ({ default: () => <aside>Queue</aside> }));
vi.mock('./ProfileWorkCanvas', () => ({ default: () => <div>Previous member canvas</div> }));
describe('member review selection states', () => {
  beforeEach(() => {
    state.model = { detail: null, openingPersonId: null, error: null };
  });
  it('prompts for a selection only while idle', () => {
    render(<ProfileWorkPanel />);
    expect(screen.getByRole('heading', { name: 'Select a person' })).toBeInTheDocument();
  });
  it('shows progress while opening and keeps the previous canvas unavailable', () => {
    state.model = { detail: { userId: 'previous' }, openingPersonId: 'next', error: null };
    render(<ProfileWorkPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading member review');
    expect(screen.queryByText('Previous member canvas')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Select a person' })).not.toBeInTheDocument();
  });
  it('shows the loaded canvas when selection finishes', () => {
    state.model.detail = { userId: 'next' };
    render(<ProfileWorkPanel />);
    expect(screen.getByText('Previous member canvas')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

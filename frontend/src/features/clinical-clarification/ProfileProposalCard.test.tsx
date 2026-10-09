import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ProfileProposalCard from './ProfileProposalCard';
import type { ProfileProposal } from './profile-proposal-types';
const proposal: ProfileProposal = {
  id: 'p1',
  profileRevision: 1,
  scopeKey: 'scope',
  status: 'PENDING',
  authorName: 'Recorded Reviewer',
  createdAt: '2026-10-10T00:00:00Z',
  rationale: 'Clarified reported diabetes type.',
  memberNote: null,
  acceptedProfileRevision: null,
  beforeSnapshot: {
    safetyInputs: [],
    healthDetails: [{ area: 'DIABETES', responses: { conditionDetails: 'Diabetes' } }],
  },
  changes: {
    domains: [],
    healthDetails: [
      {
        area: 'DIABETES',
        conditionDetails: 'Type 2 diabetes',
        medications: 'Unknown',
        dietaryAdvice: 'Unknown',
        recentSymptoms: 'None',
        measurements: '',
      },
    ],
  },
  evidenceSnapshot: [{ title: 'Diabetes clarification' }],
};
describe('profile correction comparison', () => {
  it('shows recorded before/after values and requires a reason for requesting correction', () => {
    const respond = vi.fn().mockResolvedValue(undefined);
    render(<ProfileProposalCard proposal={proposal} onRespond={respond} />);
    expect(screen.getByText('Diabetes')).toBeInTheDocument();
    expect(screen.getByText('Type 2 diabetes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request correction' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Please clarify this first.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Request correction' }));
    expect(respond).toHaveBeenCalledWith('REQUEST_CORRECTION', 'Please clarify this first.');
  });
  it('preserves accepted reviewer attribution without offering another acknowledgment', () => {
    render(
      <ProfileProposalCard
        proposal={{ ...proposal, status: 'ACCEPTED', acceptedProfileRevision: 2 }}
        onRespond={vi.fn()}
      />
    );
    expect(screen.getByText(/Recorded Reviewer, RND/)).toBeInTheDocument();
    expect(screen.getByText(/applied as profile revision 2/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Acknowledge and apply' })).not.toBeInTheDocument();
  });
});

import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ProfileClinicalReview from './ProfileClinicalReview';
import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';

const confirm = vi.fn();
function Fixture({ canReview = true, missing = false } = {}) {
  const [ids, setIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('Reviewed the member details.');
  const model = {
    detail: {
      requirements: missing ? [{ area: 'OTHER', state: 'MISSING', message: 'Complete health details.' }] : [],
      availableAreas: ['OTHER'],
      profileReview: {
        claim: { mine: true },
        needsClarification: true,
        clarificationEntryIds: ['named'],
        clarificationEntries: [
          { id: 'named', domain: 'CONDITION', displayName: 'Named condition', canReviewAsRecorded: canReview },
        ],
      },
    },
    busy: false,
    notes,
    setNotes,
    reviewedDeclarationIds: ids,
    setReviewedDeclarationIds: setIds,
    conditionAssessments: [],
    setConditionAssessments: vi.fn(),
    requestArea: 'OTHER',
    setRequestArea: vi.fn(),
    profileBlocked: !ids.length || missing,
    decideProfile: confirm,
  } as unknown as ReturnType<typeof useProfileWorkPanelModel>;
  return <ProfileClinicalReview model={model} section="decision" />;
}
it('offers unchanged confirmation without a correction and keeps the restriction explicit', () => {
  render(<Fixture />);
  expect(screen.getByRole('button', { name: 'Confirm for planning' })).toBeDisabled();
  fireEvent.click(screen.getByRole('checkbox', { name: /Reviewed as recorded/ }));
  expect(screen.getByRole('button', { name: 'Confirm for planning' })).toBeEnabled();
  expect(screen.getByText(/Confirming retains these restrictions/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm for planning' }));
  expect(confirm).toHaveBeenCalledWith('APPROVED');
});
it('lists vague declarations without an unchanged-review checkbox', () => {
  render(<Fixture canReview={false} />);
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(screen.getByText(/request clarification or correct this declaration/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm for planning' })).toBeDisabled();
});
it('still requires missing evidence after the declaration is reviewed', () => {
  render(<Fixture missing />);
  fireEvent.click(screen.getByRole('checkbox', { name: /Reviewed as recorded/ }));
  expect(screen.getByRole('button', { name: 'Confirm for planning' })).toBeDisabled();
  expect(screen.getByText(/complete and save other details/)).toBeInTheDocument();
});

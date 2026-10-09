import type { ComponentProps } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CaseDecisionSection from './CaseDecisionSection';

vi.mock('../ReviewSwapDialog', () => ({ default: ({ onNoSuitable }: { onNoSuitable: () => void }) => <button onClick={onNoSuitable}>Prepare no-match rejection</button> }));
type Props = ComponentProps<typeof CaseDecisionSection>;
function fixture() {
  const reject = vi.fn(), approve = vi.fn(), setAction = vi.fn(), noSuitable = vi.fn(), close = vi.fn();
  const replacementOutcome = { kind: 'NO_SUITABLE_REPLACEMENT' as const, searchReceipt: 'saved-search' };
  const model = { detailData: { claimStatus: { claimedByMe: true }, mealPlan: {} }, actionLoading: null,
    review: { rejectNote: 'No suitable candidate after reviewing the filtered plates.', setRejectNote: vi.fn(), handleReject: reject },
    generalNote: '', setGeneralNote: vi.fn(), handleApprove: approve } as unknown as Props['model'];
  const swap = { saving: false, filtersEnabled: true, noSuitable: true, setNoSuitable: noSuitable,
    data: { searchReceipt: 'saved-search' }, replacementOutcome, close, load: vi.fn() } as unknown as Props['swap'];
  return { model, swap, setAction, reject, approve, noSuitable, close, replacementOutcome };
}
it('keeps only approve/reject as final decisions and passes a recorded search outcome through the rejection modal', () => {
  const props = fixture();
  const { rerender } = render(<CaseDecisionSection {...props} action={null} />);
  expect(screen.getByRole('toolbar', { name: 'Meal review actions' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Swap$/ })).toBeInTheDocument();
  rerender(<CaseDecisionSection {...props} action="reject" />);
  fireEvent.click(screen.getByRole('button', { name: 'Confirm rejection' }));
  expect(props.reject).toHaveBeenCalledWith(props.replacementOutcome); expect(props.approve).not.toHaveBeenCalled();
});
it('no suitable replacement prepares a rejection and never commits a third decision', () => {
  const props = fixture(); render(<CaseDecisionSection {...props} action={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Prepare no-match rejection' }));
  expect(props.noSuitable).toHaveBeenCalledWith(true); expect(props.close).toHaveBeenCalledOnce(); expect(props.setAction).toHaveBeenCalledWith('reject');
  expect(props.reject).not.toHaveBeenCalled(); expect(props.approve).not.toHaveBeenCalled();
});

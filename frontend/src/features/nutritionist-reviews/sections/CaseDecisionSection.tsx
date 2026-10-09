'use client';
import Button from '@/components/ui/Button';
import { Check, X, ArrowLeftRight } from 'lucide-react';
import type { useCaseReviewWorkspaceModel } from './useCaseReviewWorkspaceModel';
import type { useReviewSwap } from '../useReviewSwap';
import ReviewDecisionDialog from '../ReviewDecisionDialog';
import ReviewSwapDialog from '../ReviewSwapDialog';
type Model = ReturnType<typeof useCaseReviewWorkspaceModel>;

export default function CaseDecisionSection({
  model,
  swap,
  action,
  setAction,
}: {
  model: Model;
  swap: ReturnType<typeof useReviewSwap>;
  action: 'approve' | 'reject' | null;
  setAction: (action: 'approve' | 'reject' | null) => void;
}) {
  if (!model.detailData?.claimStatus.claimedByMe) return null;
  const busy = Boolean(model.actionLoading) || swap.saving;
  return (
    <>
      <div role="toolbar" aria-label="Meal review actions" className="flex items-center gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => {
            setAction(null);
            void swap.load();
          }}
          variant="secondary"
          title="Choose a replacement; approval is still required"
        >
          <ArrowLeftRight className="mr-1 h-4 w-4" /> Swap
        </Button>
        <span className="mx-1 h-6 border-l border-brand-border" />
        <Button size="sm" disabled={busy} onClick={() => setAction('approve')}>
          <Check className="mr-1 h-4 w-4" /> Approve
        </Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => setAction('reject')}>
          <X className="mr-1 h-4 w-4" /> Reject
        </Button>
      </div>
      <ReviewDecisionDialog
        action={action}
        onClose={() => setAction(null)}
        busy={busy}
        error={model.errorMsg}
        note={action === 'reject' ? model.review.rejectNote : model.generalNote}
        onNoteChange={action === 'reject' ? model.review.setRejectNote : model.setGeneralNote}
        onConfirm={() => {
          if (action === 'reject') void model.review.handleReject(swap.replacementOutcome);
          else void model.handleApprove();
        }}
        required={action === 'reject' && swap.noSuitable}
      >
        {action === 'reject' && swap.filtersEnabled && <label className="mb-4 block text-sm">
          <input type="checkbox" checked={swap.noSuitable} disabled={busy || !swap.data?.searchReceipt}
            onChange={event => swap.setNoSuitable(event.target.checked)} className="mr-2" />
          No suitable replacement — keep this slot unavailable and stop automatic regeneration.
          {!swap.data?.searchReceipt && <span className="mt-1 block text-xs text-brand-muted">Open Swap and search the eligible library first to record this outcome.</span>}
        </label>}
      </ReviewDecisionDialog>
      <ReviewSwapDialog swap={swap} meal={model.detailData.mealPlan} onNoSuitable={() => {
        swap.setNoSuitable(true); swap.close(); setAction('reject');
      }} />
    </>
  );
}

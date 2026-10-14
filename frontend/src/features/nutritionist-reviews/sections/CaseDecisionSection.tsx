'use client';
import CanvasToolButton from '../CanvasToolButton';
import { Check, X, ArrowLeftRight } from '@/components/ui/icons';
import type { useCaseReviewWorkspaceModel } from './useCaseReviewWorkspaceModel';
import type { useReviewSwap } from '../useReviewSwap';
import ReviewDecisionPage from '../ReviewDecisionPage';
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
  if (!model.detailData) return null;
  const busy = Boolean(model.actionLoading) || swap.saving || !model.detailData.claimStatus.claimedByMe;
  return (
    <>
      <div role="toolbar" aria-label="Meal review actions" className="flex items-center gap-2">
        <CanvasToolButton
          disabled={busy}
          onClick={() => {
            setAction(null);
            void swap.load();
          }}
          aria-label="Swap"
          title="Swap meal"
        >
          <ArrowLeftRight aria-hidden="true" className="h-5 w-5" />
        </CanvasToolButton>
        <span className="mx-1 h-6 border-l border-brand-border" />
        <CanvasToolButton
          aria-label="Approve" aria-pressed={action === 'approve'} title="Approve meal"
          disabled={busy || model.detailData?.flagConcerns?.some((concern) => concern.active)}
          onClick={() => setAction('approve')}
        >
          <Check aria-hidden="true" className="h-5 w-5" />
        </CanvasToolButton>
        <CanvasToolButton aria-label="Reject" title="Reject meal" aria-pressed={action === 'reject'} className="text-red-700 dark:text-red-400" disabled={busy} onClick={() => setAction('reject')}>
          <X aria-hidden="true" className="h-5 w-5" />
        </CanvasToolButton>
      </div>
      <ReviewSwapDialog swap={swap} meal={model.detailData.mealPlan}
        onNoSuitable={() => { swap.setNoSuitable(true); swap.close(); setAction('reject'); }}
        onFindReplacement={() => { swap.setNoSuitable(false); swap.close(); setAction('reject'); }} />
    </>
  );
}

export function CaseDecisionPage({ model, swap, action, setAction, title, page }: {
  model: Model; swap: ReturnType<typeof useReviewSwap>; action: 'approve' | 'reject';
  setAction: (action: 'approve' | 'reject' | null) => void; title: string; page: number;
}) {
  const busy = Boolean(model.actionLoading) || swap.saving;
  return <ReviewDecisionPage
        action={action} title={title} page={page}
        onClose={() => setAction(null)}
        busy={busy}
        error={model.errorMsg}
        note={action === 'reject' ? model.review.rejectNote : model.generalNote}
        onNoteChange={action === 'reject' ? model.review.setRejectNote : model.setGeneralNote}
        onConfirm={() => {
          if (action === 'reject') void model.review.handleReject(swap.replacementOutcome);
          else if (!model.detailData?.flagConcerns?.some((concern) => concern.active)) void model.handleApprove();
        }}
        required
        rejectionLabel={swap.noSuitable ? 'Reject and leave unavailable' : 'Reject and find replacement'}
      >
        {action === 'reject' && !swap.noSuitable && (
          <p className="mb-4 text-sm leading-6 text-brand-muted">
            We’ll search the certified library, then stored recipes, then AI if needed. Replacements stay pending for
            review. Manual library nutrient filters do not apply to this broader search.
          </p>
        )}
        {action === 'reject' && swap.filtersEnabled && (
          <label className="mb-4 block text-sm">
            <input
              type="checkbox"
              checked={swap.noSuitable}
              disabled={busy || !swap.data?.searchReceipt}
              onChange={(event) => swap.setNoSuitable(event.target.checked)}
              className="mr-2"
            />
            No suitable replacement — keep this slot unavailable and stop automatic regeneration.
            {!swap.data?.searchReceipt && (
              <span className="mt-1 block text-xs text-brand-muted">
                Open Swap and search the eligible library first to record this outcome.
              </span>
            )}
          </label>
        )}
      </ReviewDecisionPage>;
}

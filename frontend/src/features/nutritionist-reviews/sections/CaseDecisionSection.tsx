'use client';
import Button from '@/components/ui/Button';
import { Check, X, ArrowLeftRight } from 'lucide-react';
import type { useCaseReviewWorkspaceModel } from './useCaseReviewWorkspaceModel';
import type { useReviewSwap } from '../useReviewSwap';
type Model = ReturnType<typeof useCaseReviewWorkspaceModel>;

export default function CaseDecisionSection({ model, swap }: { model: Model; swap: ReturnType<typeof useReviewSwap> }) {
  const {
    detailData,
    generalNote,
    setGeneralNote,
    review,
    showRejectForm,
    setShowRejectForm,
    actionLoading,
    handleApprove,
  } = model;
  if (!detailData?.claimStatus.claimedByMe) return null;
  const busy = Boolean(actionLoading) || swap.saving;
  return (
    <div className="space-y-3">
      {model.errorMsg && (
        <p role="alert" className="text-sm text-red-500">
          {model.errorMsg}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-muted">
          Approve the exact recorded meal. Required recipe changes need rejection or an eligible replacement.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            disabled={busy || showRejectForm || swap.open}
            onClick={handleApprove}
            isLoading={Boolean(actionLoading)}
          >
            <Check className="mr-1 h-4 w-4" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => {
              swap.close();
              setShowRejectForm(true);
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setShowRejectForm(false);
              void swap.load();
            }}
          >
            <ArrowLeftRight className="mr-1 h-4 w-4" />
            Swap
          </Button>
        </div>
      </div>
      {!showRejectForm && !swap.open && (
        <label className="block text-xs font-bold">
          Member note (optional)
          <textarea
            value={generalNote}
            onChange={(event) => setGeneralNote(event.target.value)}
            disabled={busy}
            maxLength={1000}
            rows={2}
            placeholder="Advice for the member. This does not change the saved ingredients or nutrition."
            className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm font-normal"
          />
        </label>
      )}
      {showRejectForm && (
        <div className="space-y-2">
          <label className="block text-xs font-bold">
            Rejection reason
            <textarea
              value={review.rejectNote}
              onChange={(event) => review.setRejectNote(event.target.value)}
              disabled={busy}
              rows={2}
              maxLength={1000}
              className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm font-normal"
            />
          </label>
          <p className="text-xs text-brand-muted">
            The existing rejection workflow will try an eligible replacement; otherwise the slot stays unavailable.
          </p>
          <Button size="sm" variant="danger" disabled={busy || !review.rejectNote.trim()} onClick={review.handleReject}>
            Confirm rejection
          </Button>
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => setShowRejectForm(false)}>
            Cancel
          </Button>
        </div>
      )}
      {swap.open && (
        <div className="space-y-2">
          {swap.error && (
            <p role="alert" className="text-sm text-red-500">
              {swap.error}
            </p>
          )}
          {swap.loading ? (
            <p role="status" className="text-sm">
              Checking eligible replacements…
            </p>
          ) : (
            <>
              <label className="block text-xs font-bold">
                Eligible replacement
                <select
                  value={swap.selectedId}
                  onChange={(event) => swap.setSelectedId(event.target.value)}
                  disabled={busy}
                  className="ml-3 rounded-lg border border-brand-border bg-brand-bg p-2 text-sm font-normal"
                >
                  <option value="">Choose a meal</option>
                  {swap.data?.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.mealName} · {option.calories} kcal
                    </option>
                  ))}
                </select>
              </label>
              {swap.data?.options.length === 0 && (
                <p className="text-xs text-brand-muted">
                  No certified replacement fits this member and slot. You can reject with a reason.
                </p>
              )}
              {swap.selected && (
                <p className="text-xs text-brand-muted">
                  Inspect the replacement sheet before confirming. The original remains unchanged until you submit.
                </p>
              )}
              <label className="block text-xs font-bold">
                Replacement rationale (at least 10 characters)
                <textarea
                  value={swap.note}
                  onChange={(event) => swap.setNote(event.target.value)}
                  disabled={busy}
                  maxLength={1000}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3 text-sm font-normal"
                />
              </label>
              <Button
                size="sm"
                disabled={busy || !swap.selected || swap.note.trim().length < 10}
                onClick={swap.submit}
                isLoading={swap.saving}
              >
                Confirm swap
              </Button>
              <Button size="sm" variant="secondary" disabled={busy} onClick={swap.load}>
                Refresh options
              </Button>
            </>
          )}
          <Button size="sm" variant="secondary" disabled={busy} onClick={swap.close}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

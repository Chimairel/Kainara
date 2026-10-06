'use client';

import CaseReplacementForm from '../CaseReplacementForm';

import Button from '@/components/ui/Button';

import { Check, X } from 'lucide-react';

import type { useCaseReviewWorkspaceModel } from './useCaseReviewWorkspaceModel';
type Model = Extract<ReturnType<typeof useCaseReviewWorkspaceModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'detailData'
    | 'generalNote'
    | 'setGeneralNote'
    | 'review'
    | 'showRejectForm'
    | 'isEditing'
    | 'handleApprove'
    | 'actionLoading'
    | 'selectedMealId'
    | 'setIsEditing'
    | 'setShowRejectForm'
  >;
};
export default function CaseDecisionSection({ model }: SectionProps) {
  const {
    detailData,
    generalNote,
    setGeneralNote,
    review,
    showRejectForm,
    isEditing,
    handleApprove,
    actionLoading,
    selectedMealId,
    setIsEditing,
    setShowRejectForm,
  } = model;
  if (!detailData) return null;
  return (
    <>
      {detailData.claimStatus.claimedByMe && (
        <>
          {/* Note to Patient form input */}
          <div className="bg-brand-surface/30 border border-brand-border rounded-xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">Note to Patient (optional)</h4>
            <textarea
              value={generalNote}
              onChange={(e) => setGeneralNote(e.target.value)}
              placeholder="Include a helpful message, advice, or summary context for the patient. They will see this alongside their approved meal."
              rows={2}
              className="bg-brand-bg text-brand-text border border-brand-border rounded-xl px-4 py-3 text-xs w-full focus:outline-none focus:border-brand-green resize-none leading-relaxed"
            />
          </div>

          {/* Rejection forms section with In-Flight Candidate Replacement */}
          <CaseReplacementForm review={review} />

          {/* Action buttons footer */}
          {!showRejectForm && (
            <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:gap-3">
              {isEditing ? (
                <>
                  <Button
                    variant="primary"
                    onClick={handleApprove}
                    isLoading={actionLoading === selectedMealId}
                    className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.98]"
                  >
                    <Check className="w-4 h-4" />
                    <span>Save & Approve</span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setIsEditing(false)}
                    className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 text-center justify-center"
                  >
                    Cancel Edit
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="primary"
                    onClick={handleApprove}
                    isLoading={actionLoading === selectedMealId}
                    className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.98]"
                  >
                    <Check className="w-4 h-4" />
                    <span>Approve</span>
                  </Button>
                  <p className="text-xs text-brand-muted">
                    Approvals cover this exact saved plate. Use case replacement for a different meal, or create an
                    altered recipe in the meal library for independent review.
                  </p>
                  <Button
                    variant="danger"
                    onClick={() => setShowRejectForm(true)}
                    className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    <span>Reject</span>
                  </Button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </>
  );
}

'use client';

import Button from '@/components/ui/Button';

import { ShieldCheck } from 'lucide-react';

import { Props } from './CaseReviewWorkspace.shared';
export function useCaseReviewWorkspaceModel({
  review,
  caseFilter,
  expanded,
  setExpanded,
  navigation,
  caseFilters,
}: Props) {
  const {
    queue,
    selectedMealId,
    setSelectedMealId,
    detailLoading,
    detailData,
    actionLoading,
    generalNote,
    setGeneralNote,
    errorMsg,
    handleClaimMeal,
    handleReleaseMeal,
    handleApprove,
  } = review;
  const selectedQueueMeal = queue.find((m) => m.id === selectedMealId);
  const activeClaimStatus = detailData?.claimStatus ?? selectedQueueMeal?.claimStatus;

  const claimHeader = selectedMealId ? (
    activeClaimStatus?.claimedByMe ? (
      <div className="flex items-center gap-2 rounded-xl border border-brand-green/35 bg-brand-surface/95 px-3 py-1.5 text-xs text-brand-green shadow-md backdrop-blur-md">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-green" />
        <span className="font-semibold text-xs text-brand-text">
          Claimed until{' '}
          {activeClaimStatus.claimExpiresAt
            ? new Date(activeClaimStatus.claimExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '30m'}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReleaseMeal}
          isLoading={actionLoading === selectedMealId}
          disabled={Boolean(actionLoading)}
          className="ml-1 text-[11px] h-7 px-2.5 rounded-lg border-brand-green/30 hover:border-brand-green/50"
        >
          Release claim
        </Button>
      </div>
    ) : activeClaimStatus?.claimedByOther ? (
      <span className="rounded-xl border border-[#a64600]/30 bg-[#8c3b00] px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-md">
        Being reviewed by another RND
      </span>
    ) : activeClaimStatus?.coolingDownForMe ? (
      <span className="rounded-xl border border-[#a64600]/30 bg-[#8c3b00] px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-md">
        Claim cooling down
      </span>
    ) : (
      <Button
        size="sm"
        onClick={handleClaimMeal}
        isLoading={actionLoading === selectedMealId || (detailLoading && !activeClaimStatus)}
        disabled={Boolean(actionLoading) || detailLoading || !detailData}
        className="rounded-xl shadow-md text-xs font-bold px-3.5 py-2"
      >
        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
        Claim review
      </Button>
    )
  ) : null;

  return {
    kind: 'ready' as const,
    navigation,
    caseFilters,
    review,
    caseFilter,
    expanded,
    setExpanded,
    selectedMealId,
    claimHeader,
    setSelectedMealId,
    detailLoading,
    errorMsg,
    detailData,
    generalNote,
    setGeneralNote,
    handleApprove,
    actionLoading,
  };
}

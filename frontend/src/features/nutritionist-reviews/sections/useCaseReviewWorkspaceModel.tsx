'use client';

import { ShieldCheck } from '@/components/ui/icons';
import { LogOut } from '@/components/ui/icons';
import CanvasToolButton from '../CanvasToolButton';
import Button from '@/components/ui/Button';

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
  const hasAnotherClaim = queue.some(meal => meal.id !== selectedMealId && meal.claimStatus.claimedByMe);

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
        <CanvasToolButton aria-label="Release claim" title="Release claim"
          onClick={handleReleaseMeal}
          disabled={Boolean(actionLoading)}
          className="ml-1"
        >
          <LogOut aria-hidden="true" className="h-5 w-5" />
        </CanvasToolButton>
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
      <Button size="sm" aria-label="Claim review" title="Claim review"
        onClick={handleClaimMeal}
        disabled={Boolean(actionLoading) || detailLoading || !detailData || hasAnotherClaim}
      >
        <ShieldCheck aria-hidden="true" className="mr-2 h-4 w-4" />
        {hasAnotherClaim ? 'Finish your claimed review first' : 'Claim review'}
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

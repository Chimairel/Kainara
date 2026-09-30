'use client';

import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { ReviewQueueSkeleton } from '@/features/nutritionist-reviews/NutritionistReviewsSkeleton';
import { CheckCircle, Eye, RefreshCw } from 'lucide-react';

import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';

type Props = { review: ReturnType<typeof useNutritionistReviews>; caseFilter: string; expanded: boolean };

export default function CaseReviewQueue({ review, caseFilter, expanded }: Props) {
  const { queue, fetchQueue, isLoading, selectedMealId, errorMsg, handleSelectMeal } = review;
  const visibleQueue = queue.filter((meal) =>
    caseFilter === 'second' ? meal.requiresIndependentSecondReview : !meal.requiresIndependentSecondReview
  );
  return (
    <div
      className={`${selectedMealId ? 'hidden md:flex' : 'flex'} ${expanded ? '!hidden' : ''} h-full w-full min-w-0 flex-col border-brand-border/70 bg-brand-surface/75 p-5 md:w-[38%] md:min-w-[280px] md:border-r`}
    >
      <div className="shrink-0 mb-3 rounded-2xl border border-brand-border/80 bg-brand-surface/90 p-5 text-brand-text shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">
            Meal-plan review
          </span>
          <Badge variant="pending" className="text-[9px]">
            {visibleQueue.length} pending
          </Badge>
        </div>
        <div className="mt-2.5 flex items-center justify-between">
          <h2 className="font-display text-lg font-black tracking-tight text-brand-text">Review queue</h2>
          <button
            type="button"
            onClick={() => fetchQueue()}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-border/60 bg-brand-bgAlt/60 text-brand-muted transition hover:border-brand-green/30 hover:bg-brand-green/10 hover:text-brand-green outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            title="Refresh queue"
            aria-label="Refresh queue"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-brand-muted">
          Select a meal to preview its evidence. Claim it when ready to decide.
        </p>
      </div>

      {isLoading ? (
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
          <ReviewQueueSkeleton count={5} />
        </div>
      ) : visibleQueue.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 rounded-2xl border border-dashed border-brand-border/80 bg-brand-surface/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green shadow-inner">
            <CheckCircle className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div className="space-y-1">
            <p className="font-display text-sm font-extrabold text-brand-text">Queue clear</p>
            <p role={errorMsg ? 'alert' : 'status'} className="text-xs text-brand-muted max-w-xs leading-relaxed">
              {errorMsg || 'No meals awaiting review in this queue.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-1 space-y-3 custom-scrollbar">
          {visibleQueue.map((meal) => {
            const isSelected = selectedMealId === meal.id;
            return (
              <button
                type="button"
                key={meal.id}
                disabled={meal.claimStatus.claimedByOther || meal.claimStatus.coolingDownForMe}
                aria-pressed={isSelected}
                onClick={() => {
                  if (!meal.claimStatus.claimedByOther && !meal.claimStatus.coolingDownForMe) handleSelectMeal(meal.id);
                }}
                className={`w-full rounded-2xl border p-4 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/40 ${
                  meal.claimStatus.claimedByOther || meal.claimStatus.coolingDownForMe
                    ? 'cursor-not-allowed opacity-65'
                    : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'border-brand-green/40 bg-brand-green/[0.08] shadow-md'
                    : 'border-brand-border/70 bg-brand-surface hover:-translate-y-0.5 hover:border-brand-green/25'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <span className="text-xs font-bold text-brand-green">{meal.mealType}</span>
                  <Badge variant="pending" className="text-xs">
                    {meal.requiresSafetyRevalidation ? 'Recheck needed' : 'Awaiting review'}
                  </Badge>
                </div>
                <h3 className="text-sm font-bold text-brand-text truncate mb-1">{meal.mealName}</h3>
                {meal.highRiskReviewRequired && (
                  <p className="mb-2 text-[9px] font-black uppercase tracking-wider text-[#8c3b00] dark:text-[#ff8a3d]">
                    {meal.requiresIndependentSecondReview ? 'Independent second review required' : 'Escalated review'}
                  </p>
                )}
                <p className="mb-2 text-[10px] font-bold text-brand-green">
                  {meal.reviewApprovalCount}/{meal.highRiskReviewRequired ? 2 : 1} reviews complete
                </p>
                <div className="mb-2 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide">
                  <span className="rounded-md border border-brand-border px-2 py-1 text-brand-muted">
                    {meal.sourceProvenance.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-md border border-[#a64600]/30 bg-[#8c3b00] px-2 py-1 text-white shadow-xs">
                    Shop by {new Date(meal.shoppingDeadlineAt).toLocaleDateString()}
                  </span>
                  {meal.coalescedDependentCount > 1 && (
                    <span className="rounded-md border border-brand-green/25 bg-brand-green/10 px-2 py-1 text-brand-green">
                      {meal.coalescedDependentCount} matching slots
                    </span>
                  )}
                </div>
                <p className="mb-2 text-[10px] leading-relaxed text-brand-muted">
                  Cook date {new Date(meal.cookDeadlineAt).toLocaleDateString()} · {meal.assuranceTier.toLowerCase()}{' '}
                  assurance · {meal.remainingReviewers} review{meal.remainingReviewers === 1 ? '' : 's'} remaining
                </p>
                <div className="flex items-center justify-between gap-2 text-[11px] text-brand-muted">
                  <span className="flex items-center gap-1.5 min-w-0 truncate">
                    <Avatar name={meal.user.name} size="sm" />
                    <span className="truncate">{meal.user.name}</span>
                  </span>
                  <span className="shrink-0">{new Date(meal.scheduledDate).toLocaleDateString()}</span>
                </div>
                {meal.claimStatus.claimedByOther && (
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-[#8c3b00] dark:text-[#ff8a3d] font-bold">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Being reviewed</span>
                  </div>
                )}
                {meal.claimStatus.coolingDownForMe && (
                  <p className="mt-2 text-[10px] font-bold text-[#8c3b00] dark:text-[#ff8a3d]">
                    Your claim expired. Available to other nutritionists; you can retry after{' '}
                    {meal.claimStatus.cooldownUntil
                      ? new Date(meal.claimStatus.cooldownUntil).toLocaleTimeString()
                      : 'the cooldown'}
                    .
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

'use client';

import { WorkspaceListPane } from '@/components/shared/SplitWorkspace';
import ReviewRoutingLabel from './ReviewRoutingLabel';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { ReviewQueueSkeleton } from '@/features/nutritionist-reviews/NutritionistReviewsSkeleton';
import { Apple, CheckCircle, Eye, Moon, Sun, Utensils } from 'lucide-react';

import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';

type Props = { review: ReturnType<typeof useNutritionistReviews>; caseFilter: string; expanded: boolean };

function getMealTypeTheme(mealType?: string | null) {
  const norm = (mealType || '').toUpperCase();
  if (norm.includes('BREAKFAST')) {
    return {
      label: 'Breakfast',
      icon: Sun,
      badgeStyle: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
  }
  if (norm.includes('LUNCH')) {
    return {
      label: 'Lunch',
      icon: Utensils,
      badgeStyle: 'border-brand-green/25 bg-brand-green/10 text-brand-green dark:text-emerald-400',
    };
  }
  if (norm.includes('DINNER')) {
    return {
      label: 'Dinner',
      icon: Moon,
      badgeStyle: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    };
  }
  if (norm.includes('SNACK')) {
    return {
      label: 'Snack',
      icon: Apple,
      badgeStyle: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    };
  }
  return {
    label: mealType || 'Meal',
    icon: Utensils,
    badgeStyle: 'border-brand-border/70 bg-brand-bgAlt text-brand-muted',
  };
}

export default function CaseReviewQueue({ review, expanded }: Props) {
  const { queue, isLoading, selectedMealId, errorMsg, handleSelectMeal } = review;
  const visibleQueue = queue;

  return (
    <WorkspaceListPane visible={!selectedMealId} className={expanded ? '!hidden' : ''}>
      <div className="shrink-0 mb-3 rounded-2xl border border-brand-border/80 bg-brand-surface/90 p-5 text-brand-text shadow-sm backdrop-blur-md">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">
            Meal-plan review
          </span>
          <Badge variant="pending" className="text-[9px]">
            {visibleQueue.length} pending
          </Badge>
        </div>
        <div className="mt-2.5">
          <h2 className="font-display text-lg font-black tracking-tight text-brand-text">Review queue</h2>
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
            const theme = getMealTypeTheme(meal.mealType);
            const MealIcon = theme.icon;

            return (
              <button
                type="button"
                key={meal.id}
                disabled={meal.claimStatus.claimedByOther || meal.claimStatus.coolingDownForMe}
                aria-pressed={isSelected}
                onClick={() => {
                  if (!meal.claimStatus.claimedByOther && !meal.claimStatus.coolingDownForMe) handleSelectMeal(meal.id);
                }}
                className={`group w-full rounded-2xl border p-4 sm:p-5 text-left outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green/40 ${
                  meal.claimStatus.claimedByOther || meal.claimStatus.coolingDownForMe
                    ? 'cursor-not-allowed opacity-65'
                    : 'cursor-pointer'
                } ${
                  isSelected
                    ? 'border-brand-green bg-brand-green/[0.06] shadow-md ring-1 ring-brand-green/30'
                    : 'border-brand-border/70 bg-brand-surface hover:-translate-y-0.5 hover:border-brand-green/35 hover:shadow-card'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${theme.badgeStyle} shadow-xs`}
                    >
                      <MealIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-semibold text-xs text-brand-green">{meal.mealType}</span>
                      </div>
                      <h3 className="truncate font-display text-sm font-bold text-brand-text group-hover:text-brand-green transition-colors">
                        {meal.mealName}
                      </h3>
                    </div>
                  </div>
                  <Badge variant="pending" className="text-[10px] shrink-0">
                    {meal.requiresSafetyRevalidation ? 'Updated review needed' : 'Awaiting review'}
                  </Badge>
                </div>

                {meal.highRiskReviewRequired && (
                  <p className="mt-2 text-[9px] font-black uppercase tracking-wider text-[#8c3b00] dark:text-[#ff8a3d]">
                    Review health context
                  </p>
                )}

                <p className="mt-2 text-[10px] font-bold text-brand-green">One RND approval required</p>

                {/* Member UI Macro Pills */}
                <ReviewRoutingLabel routing={meal.routing} />
                {meal.calories != null && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-0.5 text-[10px] font-bold text-brand-text dark:border-white/10 dark:bg-white/[0.06]">
                      🔥 {Math.round(meal.calories)} kcal
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#08705b]/20 bg-[#08705b]/10 px-2 py-0.5 text-[10px] font-bold text-[#08705b] dark:border-[#10b981]/30 dark:bg-[#10b981]/15 dark:text-[#34d399]">
                      {meal.proteinG ?? 0}g P
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#18b9d2]/20 bg-[#18b9d2]/10 px-2 py-0.5 text-[10px] font-bold text-[#0b7788] dark:border-[#38bdf8]/30 dark:bg-[#38bdf8]/15 dark:text-[#38bdf8]">
                      {meal.carbsG ?? 0}g C
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#eb6a38]/20 bg-[#eb6a38]/10 px-2 py-0.5 text-[10px] font-bold text-[#c74614] dark:border-[#eb6a38]/30 dark:bg-[#eb6a38]/15 dark:text-[#f09e6c]">
                      {meal.fatG ?? 0}g F
                    </span>
                  </div>
                )}

                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[9px] font-bold uppercase tracking-wide">
                  <span className="rounded-md border border-brand-border px-2 py-0.5 text-brand-muted">
                    {meal.sourceProvenance.replace(/_/g, ' ')}
                  </span>
                  <span className="rounded-md border border-[#a64600]/30 bg-[#8c3b00] px-2 py-0.5 text-white shadow-xs">
                    Shop by {new Date(meal.shoppingDeadlineAt).toLocaleDateString()}
                  </span>
                  {meal.coalescedDependentCount > 1 && (
                    <span className="rounded-md border border-brand-green/25 bg-brand-green/10 px-2 py-0.5 text-brand-green">
                      {meal.coalescedDependentCount} matching slots
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-brand-muted">
                  Cook date {new Date(meal.cookDeadlineAt).toLocaleDateString()} · {meal.assuranceTier.toLowerCase()}{' '}
                  assurance · {meal.remainingReviewers} review{meal.remainingReviewers === 1 ? '' : 's'} remaining
                </p>

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-brand-border/40 pt-2.5 text-[11px] text-brand-muted">
                  <span className="flex items-center gap-1.5 min-w-0 truncate">
                    <Avatar name={meal.user.name} size="sm" />
                    <span className="truncate">{meal.user.name}</span>
                  </span>
                  <span className="shrink-0">{new Date(meal.scheduledDate).toLocaleDateString()}</span>
                </div>

                {meal.claimStatus.claimedByOther && (
                  <div className="mt-2.5 flex items-center gap-1 text-[10px] text-[#8c3b00] dark:text-[#ff8a3d] font-bold">
                    <Eye className="w-3.5 h-3.5" />
                    <span>Being reviewed</span>
                  </div>
                )}
                {meal.claimStatus.coolingDownForMe && (
                  <p className="mt-2 text-[10px] font-bold text-[#8c3b00] dark:text-[#ff8a3d]">
                    Your claim expired. Available to other RNDs; you can retry after{' '}
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
    </WorkspaceListPane>
  );
}

'use client';

import { DashboardMealCardSurface } from '@/components/user/DashboardMealCardSurface';

import api from '@/lib/axios';
import { MealHistoryCardProps } from '@/features/meal-history/MealHistoryCard.shared';

import { useMealHistoryCardModel } from '@/features/meal-history/useMealHistoryCardModel';
import MealHistorySummary from '@/features/meal-history/MealHistorySummary';
import OutsideMealHistoryItems from '@/features/meal-history/OutsideMealHistoryItems';
import VoidOutsideMealForm from '@/features/meal-history/VoidOutsideMealForm';
import MealHistoryNotesForm from '@/features/meal-history/MealHistoryNotesForm';
export default function MealHistoryCard({
  log,
  onUpdateNotes,
  onEditOutsideItem,
  onVoidOutsideLog,
  onRequestOutsideReview,
  onReplyToOutsideReview,
  onObservedConsent,
  onObservedWithdraw,
  className = '',
}: MealHistoryCardProps) {
  const model = useMealHistoryCardModel({
    log,
    onUpdateNotes,
    onEditOutsideItem,
    onVoidOutsideLog,
    onRequestOutsideReview,
    onReplyToOutsideReview,
    onObservedConsent,
    onObservedWithdraw,
    className,
  });

  const { mealType, isExpanded, setSaveError } = model;
  return (
    <DashboardMealCardSurface mealType={mealType} className={`p-3 sm:py-3.5 sm:px-4.5 ${className}`}>
      {/* Primary Card Row */}
      <MealHistorySummary model={model} />

      {/* Expandable Drawer: Notes & Detailed Breakdown */}
      {isExpanded && (
        <div className="mt-3 pl-0 sm:pl-2">
          <div className="rounded-2xl bg-black/35 backdrop-blur-md p-3.5 sm:p-4 text-white border border-white/20 shadow-inner space-y-3">
            {/* Macros Detailed Strip */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-xl border border-white/15 bg-white/10 p-2 backdrop-blur-sm">
                <span className="font-mono text-[9px] text-white/70 uppercase tracking-wider block">Calories</span>
                <span className="font-display font-extrabold text-white text-xs sm:text-sm">
                  {Math.round(log.calories)} kcal
                </span>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-2 backdrop-blur-sm">
                <span className="font-mono text-[9px] text-emerald-200 uppercase tracking-wider block">Protein</span>
                <span className="font-display font-extrabold text-emerald-300 text-xs sm:text-sm">
                  {Math.round(log.proteinG)}g
                </span>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-2 backdrop-blur-sm">
                <span className="font-mono text-[9px] text-amber-200 uppercase tracking-wider block">Carbs</span>
                <span className="font-display font-extrabold text-amber-300 text-xs sm:text-sm">
                  {Math.round(log.carbsG)}g
                </span>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-2 backdrop-blur-sm">
                <span className="font-mono text-[9px] text-rose-200 uppercase tracking-wider block">Fat</span>
                <span className="font-display font-extrabold text-rose-300 text-xs sm:text-sm">
                  {Math.round(log.fatG)}g
                </span>
              </div>
            </div>

            {/* Outside Items list if available */}
            <OutsideMealHistoryItems model={model} />

            {log.source === 'USER_LOGGED' && log.hasImage && (
              <button
                type="button"
                className="text-xs text-emerald-300 hover:text-emerald-200 underline"
                onClick={async () => {
                  try {
                    const response = await api.get(`/user/meals/logs/${log.id}/image`, { responseType: 'blob' });
                    const url = URL.createObjectURL(response.data);
                    window.open(url, '_blank', 'noopener,noreferrer');
                    setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  } catch {
                    setSaveError('Could not open the image.');
                  }
                }}
              >
                View attached photo
              </button>
            )}

            <VoidOutsideMealForm model={model} />

            {/* Note Editor Area */}
            <MealHistoryNotesForm model={model} />
          </div>
        </div>
      )}
    </DashboardMealCardSurface>
  );
}

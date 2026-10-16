'use client';

import { useRef } from 'react';
import { useMembership } from '@/features/membership/MembershipProvider';
import OutsideReviewRequestButton from '@/features/membership/OutsideReviewRequestButton';
import { getApiErrorMessage } from '@/lib/api-error';
import OutsideMealHistoryItems, { isCurrentOutsideResponse } from './OutsideMealHistoryItems';
import type { useMealHistoryCardModel } from './useMealHistoryCardModel';

export default function MealHistoryFeedback({ model }: { model: ReturnType<typeof useMealHistoryCardModel> }) {
  const { log, isVoided, isChanging, setIsChanging, setSaveError, saveError, onRequestOutsideReview } = model;
  const { refresh } = useMembership();
  const inFlight = useRef(false);
  const items = log.outsideItems ?? [];
  const open = items.some(
    (item) => item.review?.requestedByUserAt && ['PENDING', 'CLAIMED', 'NEEDS_MORE_INFO'].includes(item.review.status)
  );
  const completed = items.length > 0 && items.every(isCurrentOutsideResponse);
  return (
    <section
      aria-label="RND feedback"
      className="space-y-3 rounded-xl border border-white/20 bg-black/20 p-4 text-sm text-white"
    >
      <h3 className="font-display font-bold">RND feedback</h3>
      {log.source === 'USER_LOGGED' ? (
        <>
          <p className="text-xs leading-relaxed text-white/90">
            Your food is already logged. Optional feedback does not approve a meal or automatically change its nutrition
            values.
          </p>
          {!isVoided && items.length > 0 && onRequestOutsideReview && !open && !completed && (
            <OutsideReviewRequestButton
              inverse
              busy={isChanging}
              onRequest={async () => {
                if (inFlight.current) return;
                inFlight.current = true;
                setIsChanging(true);
                setSaveError(null);
                try {
                  await onRequestOutsideReview(log.id, items[0].id);
                  refresh();
                } catch (error) {
                  setSaveError(getApiErrorMessage(error, 'Could not request RND feedback. Please retry.'));
                } finally {
                  inFlight.current = false;
                  setIsChanging(false);
                }
              }}
            />
          )}
          {items.length === 0 && (
            <p className="text-xs text-white/90">
              Feedback requests are unavailable for this older entry because its individual food details were not
              recorded.
            </p>
          )}
          <OutsideMealHistoryItems model={model} />
        </>
      ) : (
        <p className="text-xs leading-relaxed text-white/90">
          This is a scheduled meal record. Its RND review is shown in Meal plan; optional food-log feedback is available
          for outside-food entries.
        </p>
      )}
      {saveError && (
        <p role="alert" className="text-sm text-rose-200">
          {saveError}
        </p>
      )}
    </section>
  );
}

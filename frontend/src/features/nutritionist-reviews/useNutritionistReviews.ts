import { useCaseReviewQueue } from './useCaseReviewQueue';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/lib/axios';
import { useCallback, useEffect, useRef, useState } from 'react';

import { useRndClarificationDraft, type DraftQuestion } from '@/features/clinical-clarification/RndClarifications';
export type { QueueItem, DetailData, ReviewPayload } from './review-types';
import type { DetailData, ReviewPayload } from './review-types';

export function useNutritionistReviews(enabled = true) {
  const ownerId = useAuth().user?.userId;
  const resourceOwner = useRef(ownerId);
  const liveOwner = useRef(ownerId);
  liveOwner.current = ownerId;
  const { queue, isLoading, queueError, fetchQueue, resetQueue, removeFromQueue } = useCaseReviewQueue(
    ownerId,
    liveOwner
  );

  // Selected Card Details
  const [selectedMealId, setSelectedMealIdState] = useState<string | null>(null);
  const liveSelection = useRef(selectedMealId);
  liveSelection.current = selectedMealId;
  const selectionGeneration = useRef(0);
  const setSelectedMealId = useCallback((id: string | null) => {
    selectionGeneration.current++;
    liveSelection.current = id;
    setSelectedMealIdState(id);
  }, []);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<DetailData | null>(null);
  const detailRef = useRef(detailData);
  detailRef.current = detailData;
  const [reviewNotice, setReviewNotice] = useState<string | null>(null);
  const [savedReviewNotes, setSavedReviewNotes] = useState<
    Array<{
      mealId: string;
      mealName: string;
      contextKey?: string;
      note: string;
      rejection: string;
      clarification?: { title: string; questions: DraftQuestion[] };
    }>
  >([]);
  const clarificationDraft = useRndClarificationDraft(
    `${ownerId}:${selectedMealId}:${detailData?.reviewContext?.contextKey}`
  );

  // Actions states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const actionFlight = useRef<symbol | null>(null);
  const beginAction = (id: string) => {
    if (actionFlight.current || liveOwner.current !== ownerId) return null;
    const action = Symbol(id);
    actionFlight.current = action;
    setActionLoading(id);
    return action;
  };
  const finishAction = (action: symbol) => {
    if (actionFlight.current !== action) return;
    actionFlight.current = null;
    if (liveOwner.current === ownerId) setActionLoading(null);
  };
  const [rejectNote, setRejectNote] = useState('');
  const [generalNote, setGeneralNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const retireInactiveReview = (failure: unknown, id: string | null, notice?: string) => {
    const data = (failure as { response?: { data?: { code?: string; errorCode?: string } } } | null)?.response?.data;
    const code = data?.code ?? data?.errorCode;
    if (
      ![
        'MEAL_REVIEW_INACTIVE',
        'MEAL_REVIEW_CONTEXT_CHANGED',
        'PROFILE_REVIEW_REQUIRED',
        'CLINICAL_EVIDENCE_REQUIRED',
        'SAFETY_DECLARATION_REQUIRED',
      ].includes(code ?? '') ||
      !id ||
      liveSelection.current !== id ||
      liveOwner.current !== ownerId
    )
      return false;
    const savedDraft = {
      mealId: id,
      mealName: detailRef.current?.mealPlan.mealName ?? 'Meal review',
      contextKey: detailRef.current?.reviewContext?.contextKey,
      note: generalNote,
      rejection: rejectNote,
      ...(!notice && clarificationDraft.questions.length
        ? { clarification: { title: clarificationDraft.title, questions: clarificationDraft.questions } }
        : {}),
    };
    if (generalNote.trim() || rejectNote.trim() || (!notice && clarificationDraft.questions.length))
      setSavedReviewNotes((previous) => [...previous, savedDraft].slice(-10));
    setReviewNotice(
      notice ??
        'This review is no longer current. Your unfinished notes and questions are saved for this session. Select an available case to continue.'
    );
    removeFromQueue(id);
    setSelectedMealId(null);
    setDetailData(null);
    setErrorMsg(null);
    setDetailLoading(false);
    setGeneralNote('');
    setRejectNote('');
    return true;
  };

  useEffect(() => {
    resourceOwner.current = ownerId;
    resetQueue();
    setSelectedMealId(null);
    setDetailData(null);
    setReviewNotice(null);
    setSavedReviewNotes([]);
    setGeneralNote('');
    setRejectNote('');
    setActionLoading(null);
    actionFlight.current = null;
    setDetailLoading(false);
    setErrorMsg(null);
  }, [ownerId, setSelectedMealId, resetQueue]);

  useEffect(() => {
    if (enabled) void fetchQueue();
  }, [fetchQueue, enabled]);
  useVisiblePolling(
    async (signal) => {
      const generation = selectionGeneration.current;
      await fetchQueue(true, signal);
      if (selectedMealId && !actionLoading) {
        try {
          const response = await api.get(`/nutritionist/queue/${selectedMealId}`, { signal });
          if (
            !signal.aborted &&
            liveOwner.current === ownerId &&
            generation === selectionGeneration.current &&
            liveSelection.current === selectedMealId &&
            response.data?.success
          ) {
            const before = detailRef.current?.reviewContext?.contextKey;
            const after = response.data.data?.reviewContext?.contextKey;
            if (before && before !== after) {
              retireInactiveReview({ response: { data: { code: 'MEAL_REVIEW_CONTEXT_CHANGED' } } }, selectedMealId);
              await fetchQueue(true, signal, true);
            } else setDetailData(response.data.data);
          }
        } catch (failure) {
          if (
            !signal.aborted &&
            generation === selectionGeneration.current &&
            retireInactiveReview(failure, selectedMealId)
          )
            return;
          throw failure;
        }
      }
    },
    { enabled: enabled && !actionLoading, intervalMs: 5000, immediate: false, scopeKey: `${ownerId}:${selectedMealId}` }
  );

  const handleSelectMeal = async (id: string) => {
    setSelectedMealId(id);
    const generation = selectionGeneration.current;
    setDetailLoading(true);
    setDetailData(null);
    setErrorMsg(null);
    setRejectNote('');
    setGeneralNote('');

    try {
      const res = await api.get(`/nutritionist/queue/${id}`);
      if (liveOwner.current !== ownerId || generation !== selectionGeneration.current) return;
      if (!res.data?.success || res.data.data?.mealPlan?.id !== id)
        throw new Error('Unexpected review details response. Please retry.');
      setDetailData(res.data.data);
    } catch (err: unknown) {
      if (liveOwner.current !== ownerId || generation !== selectionGeneration.current) return;
      if (retireInactiveReview(err, id)) {
        await fetchQueue(true, undefined, true);
        return;
      }
      console.error('Failed to fetch card details:', err);
      const code = (err as { code?: string } | null)?.code;
      setErrorMsg(
        getApiErrorMessage(
          err,
          code === 'ECONNABORTED' || code === 'ETIMEDOUT'
            ? 'Loading this review took too long. Please retry.'
            : 'Review details could not be loaded. Please retry.'
        )
      );
    } finally {
      if (liveOwner.current === ownerId && generation === selectionGeneration.current) setDetailLoading(false);
    }
  };

  const handleClaimMeal = async () => {
    if (!selectedMealId || detailLoading || !detailData) return;
    const action = beginAction(selectedMealId);
    if (!action) return;
    setErrorMsg(null);
    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      const res = detailData.reviewContext
        ? await api.post(`/nutritionist/queue/${selectedMealId}/claim`, {
            expectedContextKey: detailData.reviewContext.contextKey,
          })
        : await api.post(`/nutritionist/queue/${selectedMealId}/claim`);
      if (!stillSelected()) return;
      if (!res.data?.success || res.data.data?.mealPlan?.id !== selectedMealId)
        throw new Error('Unexpected claim response. Refresh the review and try again.');
      setDetailData(res.data.data);
      await fetchQueue(false, undefined, true);
    } catch (err: unknown) {
      if (!stillSelected()) return;
      if (!retireInactiveReview(err, selectedMealId))
        setErrorMsg(getApiErrorMessage(err, 'Could not claim this meal. Refresh the queue and try again.'));
      await fetchQueue(false, undefined, true);
    } finally {
      finishAction(action);
    }
  };

  const handleReleaseMeal = async () => {
    if (!selectedMealId) return;
    const action = beginAction(selectedMealId);
    if (!action) return;
    setErrorMsg(null);
    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      await api.post(`/nutritionist/queue/${selectedMealId}/release`);
      if (!stillSelected()) return;
      setDetailData(null);
      setSelectedMealId(null);
      await fetchQueue(false, undefined, true);
    } catch (err: unknown) {
      if (!stillSelected()) return;
      setErrorMsg(getApiErrorMessage(err, 'Could not release this meal. Refresh the queue and try again.'));
      await fetchQueue(false, undefined, true);
    } finally {
      finishAction(action);
    }
  };

  const handleApprove = async () => {
    if (!selectedMealId) return;
    const action = beginAction(selectedMealId);
    if (!action) return;
    setErrorMsg(null);

    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      const payload: ReviewPayload = {
        ...(detailData?.reviewContext ? { expectedContextKey: detailData.reviewContext.contextKey } : {}),
        action: 'approve',
        note: generalNote.trim() || undefined,
      };

      await api.patch(`/nutritionist/review/${selectedMealId}`, payload);
      if (!stillSelected()) return;
      removeFromQueue(selectedMealId, true);
      setSelectedMealId(null);
      setDetailData(null);
    } catch (err: unknown) {
      if (!stillSelected()) return;
      if (retireInactiveReview(err, selectedMealId)) await fetchQueue(false, undefined, true);
      else setErrorMsg(getApiErrorMessage(err, 'Approval failed. Please refresh the queue.'));
    } finally {
      finishAction(action);
    }
  };

  const handleReject = async (replacementOutcome?: { kind: 'NO_SUITABLE_REPLACEMENT'; searchReceipt: string }) => {
    if (!selectedMealId || !rejectNote.trim()) return;
    const action = beginAction(selectedMealId);
    if (!action) return;
    setErrorMsg(null);

    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      await api.patch(`/nutritionist/review/${selectedMealId}`, {
        action: 'reject',
        ...(replacementOutcome ? { replacementOutcome } : {}),
        ...(detailData?.reviewContext ? { expectedContextKey: detailData.reviewContext.contextKey } : {}),
        note: rejectNote.trim(),
      });
      if (!stillSelected()) return;
      removeFromQueue(selectedMealId, true);
      setSelectedMealId(null);
      setDetailData(null);
      setRejectNote('');
    } catch (err: unknown) {
      if (!stillSelected()) return;
      if (retireInactiveReview(err, selectedMealId)) await fetchQueue(false, undefined, true);
      else setErrorMsg(getApiErrorMessage(err, 'Rejection failed. Please refresh the queue.'));
    } finally {
      finishAction(action);
    }
  };

  return {
    clarificationDraft,
    reviewNotice: resourceOwner.current === ownerId ? reviewNotice : null,
    dismissReviewNotice: () => setReviewNotice(null),
    savedReviewNotes: resourceOwner.current === ownerId ? savedReviewNotes : [],
    retireInactiveReview,
    queue: resourceOwner.current === ownerId ? queue : [],
    queueError,
    fetchQueue,
    isLoading,
    selectedMealId: resourceOwner.current === ownerId ? selectedMealId : null,
    setSelectedMealId,
    detailLoading,
    detailData: resourceOwner.current === ownerId ? detailData : null,
    actionLoading,
    rejectNote,
    setRejectNote,
    generalNote,
    setGeneralNote,
    errorMsg,
    handleSelectMeal,
    handleClaimMeal,
    handleReleaseMeal,
    handleApprove,
    handleReject,
  };
}

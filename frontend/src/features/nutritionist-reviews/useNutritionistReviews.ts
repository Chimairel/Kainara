import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useAuth } from '@/hooks/useAuth';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/lib/axios';
import { invalidateSessionResource, readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IngredientEvidenceSource } from './ingredient-evidence';

import type { ReviewRouting } from './review-routing';
export interface QueueItem {
  routing?: ReviewRouting;
  id: string;
  mealName: string;
  mealType: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  aiConfidenceFlag: string;
  requiresSafetyRevalidation?: boolean;
  description?: string;
  scheduledDate: string;
  user: { id: string; name: string };
  ingredients: { ingredientName: string; dataSource: string }[];
  claimStatus: {
    claimedByMe: boolean;
    claimedByOther: boolean;
    claimedByName: string | null;
    coolingDownForMe?: boolean;
    cooldownUntil?: string | null;
    claimExpiresAt?: string | null;
  };
  highRiskReviewRequired: boolean;
  reviewApprovalCount: number;
  requiresIndependentSecondReview: boolean;
  intendedCycle: { id: string; startDate: string; endDate: string; status: string };
  shoppingDeadlineAt: string;
  cookDeadlineAt: string;
  assuranceTier: 'BASE' | 'STANDARD' | 'ENHANCED';
  reviewStage: 'PRIMARY' | 'SECONDARY';
  remainingReviewers: number;
  deterministicFindings: { confidence: string; estimatedIngredientCount: number };
  sourceProvenance: 'CERTIFIED_LIBRARY' | 'RAW_RECIPE_CORPUS' | 'AI_FROM_SCRATCH';
  fallbackAvailable: boolean;
  rankingReasonCodes: string[];
  deadlinePriorityReason: string;
  coalescedDependentCount: number;
}

export interface DetailData {
  reviewContext?: { contextKey: string; profileRevision: number; scopeKey: string };
  clinicalEvidence?: {
    policyVersion: string;
    healthDetails?: Array<{ area: string; responses: Record<string, unknown>; revision: number }>;
    requirements: Array<{ area: string; state: string; message: string }>;
    documents: Array<{
      id: string;
      area: string;
      documentType: string;
      validUntil: string | null;
      facts: Array<{ code: string; valueText: string | null; valueNumber: number | null; unit: string | null }>;
    }>;
  };
  mealPlan: {
    id: string;
    planGroupId: string;
    userId: string;
    status: string;
    mealType: string;
    mealName: string;
    description?: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    aiConfidenceFlag: string;
    requiresSafetyRevalidation?: boolean;
    planType: string;
    scheduledDate: string;
    createdAt: string;
  };
  user: {
    name: string;
    age: number;
    sex: string;
    goal: string;
    dailyCalorieTarget: number;
    dietaryPreference: string;
    ricePreference: string;
    conditions: string[];
    allergies: string[];
    safetyEntries?: Array<{
      mealPlanningAssessment?: { result: string; rationale: string; reviewerName: string } | null;
      domain: 'CONDITION' | 'ALLERGY' | 'INTOLERANCE' | 'AVOIDED_INGREDIENT' | 'UNKNOWN';
      label: string;
      supportState: string;
    }>;
  };
  ingredients: {
    name: string;
    source: IngredientEvidenceSource;
    foodItemId?: string | null;
    compositionFoodName?: string | null;
    compositionSource?: string | null;
    compositionSourceUrl?: string | null;
    quantity?: number | null;
    unit?: string | null;
  }[];
  warnings: {
    severity: 'CRITICAL' | 'IMPORTANT' | 'NOTICE';
    message: string;
  }[];
  claimStatus: {
    claimedByMe: boolean;
    claimedByOther: boolean;
    claimedByName: string | null;
    coolingDownForMe?: boolean;
    cooldownUntil?: string | null;
    claimExpiresAt?: string | null;
  };
  highRiskReviewRequired: boolean;
  reviewApprovalCount: number;
  requiresIndependentSecondReview: boolean;
}

export interface ReviewPayload {
  expectedContextKey?: string;
  action: 'approve';
  note?: string;
  updates?: {
    mealName: string;
    description: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    ingredients: { name: string; category: string; dataSource: IngredientEvidenceSource }[];
  };
}

export interface CandidateMeal {
  mealName: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: { name: string; category?: string; dataSource?: 'FNRI' | 'GEMINI_ESTIMATED' }[];
}

export type ReviewEditForm = {
  mealName: string;
  description: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  ingredients: { name: string; category: string; dataSource: IngredientEvidenceSource }[];
};

export function useNutritionistReviews(enabled = true) {
  const ownerId = useAuth().user?.userId;
  const resourceOwner = useRef(ownerId);
  const cachedQueue = readSessionResource<QueueItem[]>(ownerId, 'nutritionist-case-queue', 30_000);
  const [queue, setQueue] = useState<QueueItem[]>(cachedQueue ?? []);
  const [isLoading, setIsLoading] = useState(!cachedQueue);
  const [queueError, setQueueError] = useState<string | null>(null);
  const liveOwner = useRef(ownerId);
  liveOwner.current = ownerId;
  const queueGeneration = useRef(0);
  const queueFlight = useRef<{ ownerId: string | undefined; generation: number; request: Promise<void> } | null>(null);

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
  const [savedReviewNotes, setSavedReviewNotes] = useState<Array<{ mealId: string; mealName: string; contextKey?: string; note: string; rejection: string }>>([]);

  // Actions states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [generalNote, setGeneralNote] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // In-Flight Candidate Replacement State
  const [candidateMeal, setCandidateMeal] = useState<CandidateMeal | null>(null);
  const [isGeneratingCandidate, setIsGeneratingCandidate] = useState(false);
  const [isEditingCandidate, setIsEditingCandidate] = useState(false);

  // Edit Mode
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{
    mealName: string;
    description: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
    ingredients: { name: string; category: string; dataSource: IngredientEvidenceSource }[];
  }>({
    mealName: '',
    description: '',
    calories: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    ingredients: [],
  });

  const retireInactiveReview = (failure: unknown, id: string | null) => {
    const data = (failure as { response?: { data?: { code?: string; errorCode?: string } } } | null)?.response?.data;
    const code = data?.code ?? data?.errorCode;
    if (!['MEAL_REVIEW_INACTIVE', 'MEAL_REVIEW_CONTEXT_CHANGED', 'PROFILE_REVIEW_REQUIRED', 'CLINICAL_EVIDENCE_REQUIRED', 'SAFETY_DECLARATION_REQUIRED'].includes(code ?? '') || !id || liveSelection.current !== id || liveOwner.current !== ownerId)
      return false;
    const savedDraft = {
      mealId: id, mealName: detailRef.current?.mealPlan.mealName ?? 'Meal review',
      contextKey: detailRef.current?.reviewContext?.contextKey, note: generalNote, rejection: rejectNote,
    };
    if (generalNote.trim() || rejectNote.trim()) setSavedReviewNotes((previous) => [...previous, savedDraft].slice(-10));
    setReviewNotice('This review is no longer current. Your unfinished notes are saved for this session. Select an available case to continue.');
    queueGeneration.current++;
    invalidateSessionResource(ownerId, 'nutritionist-case-queue');
    setQueue((previous) => previous.filter((meal) => meal.id !== id));
    setSelectedMealId(null);
    setDetailData(null);
    setShowRejectForm(false);
    setErrorMsg(null);
    setDetailLoading(false);
    setGeneralNote('');
    setRejectNote('');
    return true;
  };

  const fetchQueue = useCallback(
    (silent = false, signal?: AbortSignal, fresh = false) => {
      if (fresh) queueGeneration.current++;
      const generation = queueGeneration.current;
      if (
        queueFlight.current &&
        queueFlight.current.ownerId === ownerId &&
        queueFlight.current.generation === generation
      )
        return queueFlight.current.request;
      const load = async () => {
        if (!silent) {
          setQueueError(null);
          if (!readSessionResource<QueueItem[]>(ownerId, 'nutritionist-case-queue', 30_000)) setIsLoading(true);
        }
        try {
          const res = await api.get('/nutritionist/queue', { signal });
          if (signal?.aborted || liveOwner.current !== ownerId || generation !== queueGeneration.current) return;
          if (res.data?.success && Array.isArray(res.data.data)) {
            setQueue(res.data.data);
            setQueueError(null);
            writeSessionResource(ownerId, 'nutritionist-case-queue', res.data.data);
          } else throw new Error('Unexpected review queue response.');
        } catch (err) {
          if (!signal?.aborted && liveOwner.current === ownerId && generation === queueGeneration.current) {
            const code = (err as { code?: string } | null)?.code;
            setQueueError(
              getApiErrorMessage(
                err,
                code === 'ECONNABORTED' || code === 'ETIMEDOUT'
                  ? 'Loading the review queue took too long. Please retry.'
                  : 'The review queue could not be refreshed. Please retry.'
              )
            );
          }
        } finally {
          if (!silent && liveOwner.current === ownerId && generation === queueGeneration.current) setIsLoading(false);
        }
      };
      const request: Promise<void> = load().finally(() => {
        if (queueFlight.current?.request === request) queueFlight.current = null;
      });
      queueFlight.current = { ownerId, generation, request };
      return request;
    },
    [ownerId]
  );

  useEffect(() => {
    resourceOwner.current = ownerId;
    queueGeneration.current++;
    queueFlight.current = null;
    const saved = readSessionResource<QueueItem[]>(ownerId, 'nutritionist-case-queue', 30_000);
    setQueue(saved ?? []);
    setQueueError(null);
    setIsLoading(!saved);
    setSelectedMealId(null);
    setDetailData(null);
    setReviewNotice(null);
    setSavedReviewNotes([]);
    setGeneralNote('');
    setRejectNote('');
    setActionLoading(null);
    setDetailLoading(false);
    setErrorMsg(null);
    setShowRejectForm(false);
    setIsEditing(false);
    setCandidateMeal(null);
    setIsGeneratingCandidate(false);
  }, [ownerId, setSelectedMealId]);

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
          if (!signal.aborted && liveOwner.current === ownerId && generation === selectionGeneration.current && liveSelection.current === selectedMealId && response.data?.success) {
            const before = detailRef.current?.reviewContext?.contextKey;
            const after = response.data.data?.reviewContext?.contextKey;
            if (before && before !== after) {
              retireInactiveReview({ response: { data: { code: 'MEAL_REVIEW_CONTEXT_CHANGED' } } }, selectedMealId);
              await fetchQueue(true, signal, true);
            } else setDetailData(response.data.data);
          }
        } catch (failure) {
          if (!signal.aborted && generation === selectionGeneration.current && retireInactiveReview(failure, selectedMealId)) return;
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
    setIsEditing(false);
    setShowRejectForm(false);
    setRejectNote('');
    setGeneralNote('');
    setCandidateMeal(null);
    setIsEditingCandidate(false);

    try {
      const res = await api.get(`/nutritionist/queue/${id}`);
      if (liveOwner.current === ownerId && generation === selectionGeneration.current && res.data?.success) {
        setDetailData(res.data.data);
      }
    } catch (err: unknown) {
      if (liveOwner.current !== ownerId || generation !== selectionGeneration.current) return;
      if (retireInactiveReview(err, id)) { await fetchQueue(true, undefined, true); return; }
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
    setActionLoading(selectedMealId);
    setErrorMsg(null);
    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      const res = detailData.reviewContext
        ? await api.post(`/nutritionist/queue/${selectedMealId}/claim`, { expectedContextKey: detailData.reviewContext.contextKey })
        : await api.post(`/nutritionist/queue/${selectedMealId}/claim`);
      if (!stillSelected()) return;
      if (res.data?.success) setDetailData(res.data.data);
      await fetchQueue(false, undefined, true);
    } catch (err: unknown) {
      if (!stillSelected()) return;
      if (!retireInactiveReview(err, selectedMealId))
        setErrorMsg(getApiErrorMessage(err, 'Could not claim this meal. Refresh the queue and try again.'));
      await fetchQueue(false, undefined, true);
    } finally {
      if (liveOwner.current === ownerId) setActionLoading(null);
    }
  };

  const handleReleaseMeal = async () => {
    if (!selectedMealId) return;
    setActionLoading(selectedMealId);
    setErrorMsg(null);
    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      await api.post(`/nutritionist/queue/${selectedMealId}/release`);
      if (!stillSelected()) return;
      setDetailData(null);
      setSelectedMealId(null);
      setIsEditing(false);
      setShowRejectForm(false);
      setCandidateMeal(null);
      await fetchQueue(false, undefined, true);
    } catch (err: unknown) {
      if (!stillSelected()) return;
      setErrorMsg(getApiErrorMessage(err, 'Could not release this meal. Refresh the queue and try again.'));
      await fetchQueue(false, undefined, true);
    } finally {
      if (liveOwner.current === ownerId) setActionLoading(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedMealId) return;
    setActionLoading(selectedMealId);
    setErrorMsg(null);

    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      const payload: ReviewPayload = {
        ...(detailData?.reviewContext ? { expectedContextKey: detailData.reviewContext.contextKey } : {}),
        action: 'approve',
        note: generalNote.trim() || undefined,
      };

      if (isEditing) {
        payload.updates = {
          mealName: editForm.mealName,
          description: editForm.description,
          calories: editForm.calories,
          proteinG: editForm.proteinG,
          carbsG: editForm.carbsG,
          fatG: editForm.fatG,
          ingredients: editForm.ingredients,
        };
      }

      await api.patch(`/nutritionist/review/${selectedMealId}`, payload);
      if (!stillSelected()) return;
      queueGeneration.current++;
      queueFlight.current = null;
      invalidateSessionResource(ownerId, 'nutritionist-case-queue');
      setQueue((prev) => prev.filter((m) => m.id !== selectedMealId));
      setSelectedMealId(null);
      setDetailData(null);
      setIsEditing(false);
    } catch (err: unknown) {
      if (!stillSelected()) return;
      if (retireInactiveReview(err, selectedMealId)) await fetchQueue(false, undefined, true);
      else setErrorMsg(getApiErrorMessage(err, 'Approval failed. Please refresh the queue.'));
    } finally {
      if (liveOwner.current === ownerId) setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedMealId || !rejectNote.trim()) return;
    setActionLoading(selectedMealId);
    setErrorMsg(null);

    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      await api.patch(`/nutritionist/review/${selectedMealId}`, {
        action: 'reject',
        ...(detailData?.reviewContext ? { expectedContextKey: detailData.reviewContext.contextKey } : {}),
        note: rejectNote.trim(),
      });
      if (!stillSelected()) return;
      queueGeneration.current++;
      queueFlight.current = null;
      invalidateSessionResource(ownerId, 'nutritionist-case-queue');
      setQueue((prev) => prev.filter((m) => m.id !== selectedMealId));
      setSelectedMealId(null);
      setDetailData(null);
      setShowRejectForm(false);
      setRejectNote('');
    } catch (err: unknown) {
      if (!stillSelected()) return;
      if (retireInactiveReview(err, selectedMealId)) await fetchQueue(false, undefined, true);
      else setErrorMsg(getApiErrorMessage(err, 'Rejection failed. Please refresh the queue.'));
    } finally {
      if (liveOwner.current === ownerId) setActionLoading(null);
    }
  };

  const handleGenerateCandidate = async () => {
    if (!selectedMealId || !rejectNote.trim() || isGeneratingCandidate) return;
    setIsGeneratingCandidate(true);
    setErrorMsg(null);

    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      const res = await api.post(`/nutritionist/review/${selectedMealId}/regenerate-candidate`, {
        reason: rejectNote.trim(),
        ...(detailData?.reviewContext ? { expectedContextKey: detailData.reviewContext.contextKey } : {}),
      });
      if (!stillSelected()) return;
      if (res.data?.data) {
        setCandidateMeal(res.data.data);
      }
    } catch (err: unknown) {
      if (!stillSelected()) return;
      if (retireInactiveReview(err, selectedMealId)) { await fetchQueue(true, undefined, true); return; }
      console.error('Generate candidate failed:', err);
      setErrorMsg(
        getApiErrorMessage(err, 'Failed to generate replacement candidate. Please check the rejection reason.')
      );
    } finally {
      if (liveOwner.current === ownerId) setIsGeneratingCandidate(false);
    }
  };

  const handleReplaceAndApprove = async () => {
    if (!selectedMealId || !candidateMeal || !rejectNote.trim()) return;
    setActionLoading(selectedMealId);
    setErrorMsg(null);

    const generation = selectionGeneration.current;
    const stillSelected = () => liveOwner.current === ownerId && generation === selectionGeneration.current;
    try {
      await api.post(`/nutritionist/review/${selectedMealId}/replace-and-approve`, {
        reason: rejectNote.trim(),
        note: generalNote.trim() || undefined,
        candidate: candidateMeal,
        ...(detailData?.reviewContext ? { expectedContextKey: detailData.reviewContext.contextKey } : {}),
      });
      if (!stillSelected()) return;
      queueGeneration.current++;
      queueFlight.current = null;
      invalidateSessionResource(ownerId, 'nutritionist-case-queue');
      setQueue((prev) => prev.filter((m) => m.id !== selectedMealId));
      setSelectedMealId(null);
      setDetailData(null);
      setShowRejectForm(false);
      setRejectNote('');
      setCandidateMeal(null);
      setIsEditingCandidate(false);
    } catch (err: unknown) {
      if (!stillSelected()) return;
      if (retireInactiveReview(err, selectedMealId)) { await fetchQueue(true, undefined, true); return; }
      console.error('Replacement submission failed:', err);
      setErrorMsg(
        getApiErrorMessage(err, 'Failed to submit the replacement for meal verification. Please refresh the queue.')
      );
    } finally {
      if (liveOwner.current === ownerId) setActionLoading(null);
    }
  };

  const updateCandidateField = <K extends keyof CandidateMeal>(field: K, value: CandidateMeal[K]) => {
    setCandidateMeal((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const addCandidateIngredient = () => {
    setCandidateMeal((prev) =>
      prev
        ? {
            ...prev,
            ingredients: [...prev.ingredients, { name: '', category: 'PANTRY', dataSource: 'GEMINI_ESTIMATED' }],
          }
        : prev
    );
  };

  const removeCandidateIngredient = (index: number) => {
    setCandidateMeal((prev) =>
      prev
        ? {
            ...prev,
            ingredients: prev.ingredients.filter((_, i) => i !== index),
          }
        : prev
    );
  };

  const updateCandidateIngredient = (index: number, name: string) => {
    setCandidateMeal((prev) => {
      if (!prev) return prev;
      const updated = [...prev.ingredients];
      updated[index] = { ...updated[index], name };
      return { ...prev, ingredients: updated };
    });
  };

  const resetCandidate = () => {
    setCandidateMeal(null);
    setIsEditingCandidate(false);
  };

  const startEditing = () => {
    if (!detailData) return;
    setEditForm({
      mealName: detailData.mealPlan.mealName,
      description: detailData.mealPlan.description || '',
      calories: detailData.mealPlan.calories,
      proteinG: detailData.mealPlan.proteinG,
      carbsG: detailData.mealPlan.carbsG,
      fatG: detailData.mealPlan.fatG,
      ingredients: detailData.ingredients.map((ing) => ({
        name: ing.name,
        category: 'PANTRY',
        dataSource: ing.source,
      })),
    });
    setIsEditing(true);
  };

  const addIngredientField = () => {
    setEditForm((prev) => ({
      ...prev,
      ingredients: [...prev.ingredients, { name: '', category: 'PANTRY', dataSource: 'GEMINI_ESTIMATED' }],
    }));
  };

  const removeIngredientField = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  };

  const updateIngredientField = (index: number, value: string) => {
    setEditForm((prev) => {
      const updated = [...prev.ingredients];
      updated[index] = { ...updated[index], name: value };
      return { ...prev, ingredients: updated };
    });
  };

  const flagColor = (flag: string): 'rejected' | 'pending' | 'verified' => {
    switch (flag) {
      case 'NEEDS_REVIEW':
        return 'rejected';
      case 'CAUTION':
        return 'pending';
      default:
        return 'verified';
    }
  };
  return {
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
    showRejectForm,
    setShowRejectForm,
    generalNote,
    setGeneralNote,
    errorMsg,
    candidateMeal,
    setCandidateMeal,
    isGeneratingCandidate,
    isEditingCandidate,
    setIsEditingCandidate,
    handleGenerateCandidate,
    handleReplaceAndApprove,
    updateCandidateField,
    addCandidateIngredient,
    removeCandidateIngredient,
    updateCandidateIngredient,
    resetCandidate,
    isEditing,
    setIsEditing,
    editForm,
    setEditForm,
    handleSelectMeal,
    handleClaimMeal,
    handleReleaseMeal,
    handleApprove,
    handleReject,
    startEditing,
    addIngredientField,
    removeIngredientField,
    updateIngredientField,
    flagColor,
  };
}

'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useCallback, useEffect, useRef, useState } from 'react';

import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { toast } from 'sonner';

import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { QueueRow, ObservedSubmission, OutsideQueues } from './OutsideMealReviewsPanel.shared';
export function useOutsideMealReviewsPanelModel({ embedded = false }: { embedded?: boolean } = {}) {
  const ownerId = useAuth().user?.userId;
  const liveOwner = useRef(ownerId);
  liveOwner.current = ownerId;
  const [stateOwner, setStateOwner] = useState(ownerId);
  const ownsState = stateOwner === ownerId;
  const isCurrent = () => liveOwner.current === ownerId;
  const cached = readSessionResource<OutsideQueues>(ownerId, 'nutritionist-outside-queues', 30_000);
  const [isLoading, setIsLoading] = useState(!cached);
  const [rows, setRows] = useState<QueueRow[]>(cached?.rows ?? []);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [feedback, setFeedback] = useState('');
  const feedbackFlight = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState<ObservedSubmission[]>(cached?.submissions ?? []);
  const [observed, setObserved] = useState<ObservedSubmission | null>(null);
  const [observedKind, setObservedKind] = useState<'FOOD_REFERENCE' | 'RECIPE_CANDIDATE'>('FOOD_REFERENCE');
  const [canonicalName, setCanonicalName] = useState('');
  const [ingredientLines, setIngredientLines] = useState('');
  const [preparation, setPreparation] = useState('');
  const [applicableTypes, setApplicableTypes] = useState<string[]>([]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!ownerId || liveOwner.current !== ownerId) return;
      setError(null);
      try {
        const [reviews, observations] = await Promise.all([
          api.get('/nutritionist/outside-meal-reviews', signal ? { signal } : undefined),
          api.get('/nutritionist/observed-meal-submissions', signal ? { signal } : undefined),
        ]);
        if (signal?.aborted || liveOwner.current !== ownerId) return;
        const next = { rows: reviews.data?.data ?? [], submissions: observations.data?.data ?? [] };
        setRows(next.rows);
        setSubmissions(next.submissions);
        writeSessionResource(ownerId, 'nutritionist-outside-queues', next);
      } catch (err) {
        if (!signal?.aborted && liveOwner.current === ownerId)
          setError(getApiErrorMessage(err, 'Failed to load outside-meal reviews.'));
      } finally {
        if (liveOwner.current === ownerId) setIsLoading(false);
      }
    },
    [ownerId]
  );

  useVisiblePolling(
    async (signal) => {
      await load(signal);
    },
    { enabled: Boolean(ownerId) && !busy, intervalMs: 60_000, immediate: false, scopeKey: ownerId }
  );

  useEffect(() => {
    setStateOwner(ownerId);
    setRows([]);
    setSubmissions([]);
    setSelected(null);
    setObserved(null);
    setFeedback('');
    setError(null);
    setBusy(false);
    setIsLoading(true);
    void load();
  }, [load, ownerId]);

  useEffect(() => {
    setSelected((current) => {
      const latest = rows.find((row) => row.id === current?.id);
      return current && latest ? { ...current, claimStatus: latest.claimStatus } : current;
    });
  }, [rows]);

  const selectReview = (row: QueueRow | null) => {
    if (!isCurrent() || feedbackFlight.current) return;
    setSelected(row);
    setFeedback('');
    setError(null);
  };

  const sendFeedback = async () => {
    if (!selected || !isCurrent() || feedback.trim().length < 3 || feedbackFlight.current) return;
    const opened = selected;
    feedbackFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/nutritionist/outside-meal-reviews/${opened.id}`, {
        action: 'FEEDBACK',
        expectedRevision: opened.outsideMealLogItem.currentRevision,
        reason: feedback.trim(),
      });
      if (!isCurrent()) return;
      setSelected(null);
      setFeedback('');
      setRows((previous) => previous.filter((row) => row.id !== opened.id));
      toast.success('Feedback sent', { description: 'The member has been notified.' });
      window.dispatchEvent(new Event('nutrimind:review-work-updated'));
      await load();
    } catch (err) {
      if (isCurrent()) setError(getApiErrorMessage(err, 'Feedback could not be sent. Your draft is still here.'));
    } finally {
      feedbackFlight.current = false;
      if (isCurrent()) setBusy(false);
    }
  };
  const selectObserved = (row: ObservedSubmission) => {
    if (!isCurrent()) return;
    setObserved(row);
    setObservedKind('FOOD_REFERENCE');
    setCanonicalName(row.sourceOutsideMealItem?.name ?? '');
    const ingredients = row.sourceOutsideMealItem?.ingredients;
    setIngredientLines(
      Array.isArray(ingredients)
        ? ingredients
            .flatMap((item) => {
              if (!item || typeof item !== 'object' || !('name' in item)) return [];
              const ingredient = item as { name: string; quantity?: number; unit?: string };
              return [`${ingredient.name} | ${ingredient.quantity ?? ''} | ${ingredient.unit ?? ''}`];
            })
            .join('\n')
        : ''
    );
    setPreparation(row.sourceOutsideMealItem?.mealLog.estimationContext ?? '');
    setApplicableTypes(
      row.sourceOutsideMealItem?.mealLog.mealType &&
        ['BREAKFAST', 'LUNCH', 'DINNER'].includes(row.sourceOutsideMealItem.mealLog.mealType)
        ? [row.sourceOutsideMealItem.mealLog.mealType]
        : []
    );
  };

  const admitObserved = async () => {
    if (!observed || !isCurrent()) return;
    setBusy(true);
    setError(null);
    try {
      const ingredients = ingredientLines
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, amount, unit] = line.split('|').map((part) => part.trim());
          return { name, quantity: Number(amount), unit };
        });
      await api.post(`/nutritionist/observed-meal-submissions/${observed.id}/admit`, {
        kind: observedKind,
        canonicalName: canonicalName.trim(),
        ...(observedKind === 'RECIPE_CANDIDATE'
          ? {
              ingredients,
              preparation: preparation.trim(),
              mealTypes: applicableTypes,
            }
          : {}),
      });
      if (!isCurrent()) return;
      setObserved(null);
      await load();
    } catch (err) {
      if (isCurrent()) setError(getApiErrorMessage(err, 'Could not classify this observation.'));
    } finally {
      if (isCurrent()) setBusy(false);
    }
  };

  return {
    kind: 'ready' as const,
    embedded,
    error: ownsState ? error : null,
    isLoading: !ownsState || isLoading,
    rows: ownsState ? rows : [],
    selected: ownsState ? selected : null,
    busy: ownsState && busy,
    selectReview,
    setError,
    feedback: ownsState ? feedback : '',
    setFeedback,
    sendFeedback,
    submissions: ownsState ? submissions : [],
    selectObserved,
    observed: ownsState ? observed : null,
    observedKind,
    setObservedKind,
    canonicalName,
    setCanonicalName,
    ingredientLines,
    setIngredientLines,
    preparation,
    setPreparation,
    applicableTypes,
    setApplicableTypes,
    admitObserved,
  };
}

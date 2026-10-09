'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { DetailData } from './useNutritionistReviews';

export type SwapOption = {
  id: string;
  mealName: string;
  description: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  recipeSignature: string;
  evidenceRevision: number;
  ingredients: DetailData['ingredients'];
};
type Options = { expectedVersion: string; options: SwapOption[] };
const message = (error: unknown) =>
  getApiErrorMessage(error, 'Unable to load or save the replacement. Refresh the review and try again.');

/** State belongs to the case, outside the canvas fullscreen portal. */
export function useReviewSwap(mealId: string | null, claimed: boolean, onSuccess: () => Promise<void>) {
  const [open, setOpen] = useState(false),
    [data, setData] = useState<Options | null>(null);
  const [selectedId, setSelectedId] = useState(''),
    [note, setNote] = useState('');
  const [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const scope = useRef(0),
    pending = useRef(false),
    abort = useRef<AbortController | null>(null);
  const invalidate = useCallback(() => {
    scope.current++;
    abort.current?.abort();
  }, []);
  useEffect(() => {
    invalidate();
    pending.current = false;
    setOpen(false);
    setData(null);
    setSelectedId('');
    setNote('');
    setError('');
    setLoading(false);
    setSaving(false);
    return invalidate;
  }, [mealId, claimed, invalidate]);
  const selected = data?.options.find((option) => option.id === selectedId) ?? null;
  const load = async () => {
    if (!mealId || !claimed || pending.current) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const generation = scope.current;
    setOpen(true);
    setLoading(true);
    setError('');
    setData(null);
    setSelectedId('');
    try {
      const response = await api.get(`/nutritionist/queue/${mealId}/swap-options`, { signal: controller.signal });
      if (generation === scope.current && !controller.signal.aborted) setData(response.data.data);
    } catch (failure) {
      if (generation === scope.current && !controller.signal.aborted) setError(message(failure));
    } finally {
      if (generation === scope.current && !controller.signal.aborted) setLoading(false);
    }
  };
  const submit = async () => {
    if (!mealId || !claimed || !selected || !data || note.trim().length < 10 || pending.current) return;
    pending.current = true;
    setSaving(true);
    setError('');
    const generation = scope.current;
    try {
      await api.post(`/nutritionist/queue/${mealId}/swap`, {
        libraryMealId: selected.id,
        expectedVersion: data.expectedVersion,
        expectedRecipeSignature: selected.recipeSignature,
        expectedEvidenceRevision: selected.evidenceRevision,
        note: note.trim(),
      });
      if (generation === scope.current) await onSuccess();
    } catch (failure) {
      if (generation === scope.current) {
        setError(message(failure));
        setData(null);
        setSelectedId('');
      }
    } finally {
      if (generation === scope.current) {
        pending.current = false;
        setSaving(false);
      }
    }
  };
  return {
    open,
    close: () => {
      if (!saving) setOpen(false);
    },
    selected,
    selectedId,
    setSelectedId,
    note,
    setNote,
    loading,
    saving,
    error,
    data,
    load,
    submit,
  };
}

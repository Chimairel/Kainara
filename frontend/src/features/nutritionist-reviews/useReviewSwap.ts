'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { DetailData } from './useNutritionistReviews';
import { parseFilterDraft, type FilterDraft, type NutrientFilters, type NutrientKey } from './ReviewNutrientFilters';

import type { SwapOption as MemberSwapOption } from '@/features/meals/meals-workspace.types';
export type SwapOption = MemberSwapOption & {
  id: string;
  mealName: string;
  description?: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  recipeSignature: string;
  evidenceRevision: number;
  servingKey?: string;
  nutrients?: Record<NutrientKey, number | null>;
  pairedRiceG?: number | null;
  ingredients: DetailData['ingredients'];
};
type Options = { expectedVersion: string; options: SwapOption[]; filtersEnabled?: boolean; filters?: NutrientFilters;
  searchReceipt?: string; nextCursor?: string | null; summary?: { matchedCount: number; unknownExcludedCount: number; searchedAt: string } };
const message = (error: unknown) =>
  getApiErrorMessage(error, 'Unable to load or save the replacement. Refresh the review and try again.');

/** State belongs to the case, outside the canvas fullscreen portal. */
export function useReviewSwap(
  mealId: string | null,
  claimed: boolean,
  onSuccess: (replacementId: string) => Promise<void>,
  expectedContextKey?: string,
  onInvalidated?: (failure: unknown) => boolean
) {
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
  const [filterDraft, setFilterDraftState] = useState<FilterDraft>({});
  const [noSuitable, setNoSuitable] = useState(false);
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
    setFilterDraftState({});
    setNoSuitable(false);
    return invalidate;
  }, [mealId, claimed, expectedContextKey, invalidate]);
  const selected = data?.options.find((option) => option.id === selectedId) ?? null;
  const setFilterDraft = (value: FilterDraft) => {
    invalidate(); setFilterDraftState(value); setData(null); setSelectedId(''); setNoSuitable(false); setLoading(false); setError('');
  };
  const load = async (cursor?: string) => {
    if (!mealId || !claimed || pending.current) return;
    const filters = parseFilterDraft(filterDraft);
    if (expectedContextKey && !filters) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const generation = scope.current;
    setOpen(true);
    setLoading(true);
    setError('');
    setData(null);
    setSelectedId('');
    setNoSuitable(false);
    try {
      const response = await api.get(`/nutritionist/queue/${mealId}/swap-options`, { signal: controller.signal,
        ...(expectedContextKey ? { params: { expectedContextKey, filters: JSON.stringify(filters), ...(cursor ? { cursor } : {}) } } : {}),
      });
      if (generation === scope.current && !controller.signal.aborted) setData(response.data.data);
    } catch (failure) {
      if (generation === scope.current && !controller.signal.aborted && !onInvalidated?.(failure)) setError(message(failure));
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
      const response = await api.post(`/nutritionist/queue/${mealId}/swap`, {
        libraryMealId: selected.id,
        ...(expectedContextKey ? { expectedContextKey } : {}),
        expectedVersion: data.expectedVersion,
        expectedRecipeSignature: selected.recipeSignature,
        expectedEvidenceRevision: selected.evidenceRevision,
        ...(data.filtersEnabled ? { expectedServingKey: selected.servingKey, filters: data.filters ?? {} } : {}),
        note: note.trim(),
      });
      if (generation === scope.current) {
        setOpen(false);
        await onSuccess(response.data.data.replacementPlanId);
      }
    } catch (failure) {
      if (generation === scope.current) {
        if (onInvalidated?.(failure)) return;
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
    filterDraft, setFilterDraft, filtersEnabled: Boolean(expectedContextKey), noSuitable, setNoSuitable,
    replacementOutcome: noSuitable && data?.searchReceipt ? { kind: 'NO_SUITABLE_REPLACEMENT' as const, searchReceipt: data.searchReceipt } : undefined,
  };
}

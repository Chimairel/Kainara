import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useReviewSwap } from './useReviewSwap';
import { toast } from 'sonner';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
const preview = {
  expectedVersion: 'a'.repeat(64),
  options: [{ id: 'meal', mealName: 'Soup', recipeSignature: 'b'.repeat(64), evidenceRevision: 2, ingredients: [] }],
};
beforeEach(() => vi.resetAllMocks());
it('explains search timeouts and allows a clean retry without refreshing the review', async () => {
  vi.mocked(api.get).mockRejectedValueOnce({ code: 'ECONNABORTED' }).mockResolvedValueOnce({ data: { data: preview } });
  const { result } = renderHook(() => useReviewSwap('case', true, vi.fn(async () => {})));
  await act(() => result.current.load());
  expect(result.current.error).toMatch(/search took too long.*Refresh options/);
  expect(result.current.loading).toBe(false);
  expect(result.current.data).toBeNull();
  await act(() => result.current.load());
  expect(result.current.error).toBe('');
  expect(result.current.data).toEqual(preview);
});
it('requires selection and rationale, sends immutable version fields, and prevents double submissions', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: preview } });
  let finish!: (value: unknown) => void;
  vi.mocked(api.post).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const success = vi.fn(async () => {});
  const mutation = vi.fn();
  const { result } = renderHook(() => useReviewSwap('case', true, success, undefined, undefined, mutation));
  await act(() => result.current.submit());
  expect(api.post).not.toHaveBeenCalled();
  await act(() => result.current.load());
  act(() => {
    result.current.setSelectedId('meal');
    result.current.setNote('Recorded review rationale.');
  });
  let submitted!: Promise<void>;
  act(() => {
    submitted = result.current.submit();
    void result.current.submit();
  });
  expect(api.post).toHaveBeenCalledTimes(1);
  expect(mutation).toHaveBeenCalledWith(true);
  expect(api.post).toHaveBeenCalledWith('/nutritionist/queue/case/swap', {
    libraryMealId: 'meal',
    expectedVersion: preview.expectedVersion,
    expectedRecipeSignature: 'b'.repeat(64),
    expectedEvidenceRevision: 2,
    note: 'Recorded review rationale.',
  });
  await act(async () => {
    finish({ data: { data: { replacementPlanId: 'replacement' } } });
    await submitted;
  });
  expect(success).toHaveBeenCalledWith('replacement');
  expect(mutation.mock.calls).toEqual([[true], [false]]);
  expect(result.current.open).toBe(false);
  expect(toast.success).toHaveBeenCalledExactlyOnceWith('Meal swapped', {
    description: 'Review the replacement before approving or rejecting it.',
  });
});
it('retains rationale after a conflict and requires refreshing options before retry', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: preview } });
  vi.mocked(api.post).mockRejectedValue({ response: { data: { error: 'Recipe evidence changed.' } } });
  const { result } = renderHook(() =>
    useReviewSwap(
      'case',
      true,
      vi.fn(async () => {})
    )
  );
  await act(() => result.current.load());
  act(() => {
    result.current.setSelectedId('meal');
    result.current.setNote('Recorded review rationale.');
  });
  await act(() => result.current.submit());
  expect(result.current.error).toBe('Recipe evidence changed.');
  expect(toast.success).not.toHaveBeenCalled();
  expect(result.current.note).toBe('Recorded review rationale.');
  expect(result.current.selected).toBeNull();
  await act(() => result.current.submit());
  expect(api.post).toHaveBeenCalledTimes(1);
});

it('ignores a swap response after leaving its case, including the success toast', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: preview } });
  let finish!: (value: unknown) => void;
  vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const success = vi.fn(async () => {});
  const { result, rerender } = renderHook(({ id }) => useReviewSwap(id, true, success), { initialProps: { id: 'first' } });
  await act(() => result.current.load());
  act(() => { result.current.setSelectedId('meal'); result.current.setNote('Recorded review rationale.'); });
  let pending!: Promise<void>;
  act(() => { pending = result.current.submit(); });
  rerender({ id: 'another-case' });
  await act(async () => { finish({ data: { data: { replacementPlanId: 'replacement' } } }); await pending; });
  expect(success).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});
it('ignores late option responses after moving to another case or losing the claim', async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const { result, rerender } = renderHook(
    ({ id, claimed }) =>
      useReviewSwap(
        id,
        claimed,
        vi.fn(async () => {})
      ),
    { initialProps: { id: 'first', claimed: true } }
  );
  act(() => {
    void result.current.load();
  });
  rerender({ id: 'second', claimed: false });
  await act(async () => finish({ data: { data: preview } }));
  await waitFor(() => expect(result.current.data).toBeNull());
  expect(result.current.open).toBe(false);
  await act(() => result.current.load());
  expect(api.get).toHaveBeenCalledTimes(1);
});
it('binds a complete-serving swap to applied filters, not stale draft limits, and clears the search outcome on context change', async () => {
  const enabled = { ...preview, filtersEnabled: true, filters: { sugarG: { max: 36 } }, searchReceipt: 'signed-search',
    options: [{ ...preview.options[0], servingKey: 'c'.repeat(64) }] };
  vi.mocked(api.get).mockResolvedValue({ data: { data: enabled } });
  vi.mocked(api.post).mockResolvedValue({ data: { data: { replacementPlanId: 'replacement' } } });
  const { result, rerender } = renderHook(({ context }) => useReviewSwap('case', true, vi.fn(async () => {}), context), { initialProps: { context: 'a'.repeat(64) } });
  act(() => result.current.setFilterDraft({ sugarG: { max: '36' } }));
  await act(() => result.current.load());
  expect(api.get).toHaveBeenLastCalledWith('/nutritionist/queue/case/swap-options', expect.objectContaining({ params: { expectedContextKey: 'a'.repeat(64), filters: '{"sugarG":{"max":36}}' } }));
  act(() => { result.current.setSelectedId('meal'); result.current.setNote('Recorded complete-plate rationale.'); result.current.setNoSuitable(true); });
  expect(result.current.replacementOutcome).toEqual({ kind: 'NO_SUITABLE_REPLACEMENT', searchReceipt: 'signed-search' });
  await act(() => result.current.submit());
  expect(api.post).toHaveBeenLastCalledWith('/nutritionist/queue/case/swap', expect.objectContaining({ filters: enabled.filters, expectedServingKey: 'c'.repeat(64) }));
  act(() => result.current.setFilterDraft({ sugarG: { max: '20' } }));
  expect(result.current.data).toBeNull(); expect(result.current.selected).toBeNull(); expect(result.current.replacementOutcome).toBeUndefined();
  await act(() => result.current.submit()); expect(api.post).toHaveBeenCalledTimes(1);
  await act(() => result.current.load()); act(() => result.current.setNoSuitable(true));
  rerender({ context: 'b'.repeat(64) }); expect(result.current.replacementOutcome).toBeUndefined(); expect(result.current.filterDraft).toEqual({});
});
it('filter edits abort a pending search and invalid limits cannot submit or load', async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { result } = renderHook(() => useReviewSwap('case', true, vi.fn(async () => {}), 'a'.repeat(64)));
  act(() => { void result.current.load(); });
  act(() => result.current.setFilterDraft({ sodiumMg: { min: '3', max: '2' } }));
  await act(async () => finish({ data: { data: preview } }));
  expect(result.current.data).toBeNull(); expect(result.current.loading).toBe(false);
  await act(() => result.current.load()); expect(api.get).toHaveBeenCalledTimes(1);
});

it('applies food and multiple nutrient filters in one request and retains the applied serving evidence', async () => {
  const filters = { proteinG: { min: 35.7, max: 35.7 }, fatG: { max: 14.6 } };
  const page = { ...preview, filtersEnabled: true, filters, search: 'pork', options: [{ ...preview.options[0], servingKey: 'c'.repeat(64) }] };
  vi.mocked(api.get).mockResolvedValue({ data: { data: page } });
  vi.mocked(api.post).mockResolvedValue({ data: { data: { replacementPlanId: 'replacement' } } });
  const { result } = renderHook(() => useReviewSwap('case', true, vi.fn(async () => {}), 'a'.repeat(64)));
  await act(() => result.current.applyFilters({ proteinG: { mode: 'exact', min: '35.7' }, fatG: { max: '14.6' } }, ' pork '));
  expect(api.post).not.toHaveBeenCalled();
  expect(api.get).toHaveBeenLastCalledWith('/nutritionist/queue/case/swap-options', expect.objectContaining({ params: { expectedContextKey: 'a'.repeat(64), filters: JSON.stringify(filters), search: 'pork' } }));
  await act(() => result.current.load('next-page'));
  expect(api.get).toHaveBeenLastCalledWith('/nutritionist/queue/case/swap-options', expect.objectContaining({ params: expect.objectContaining({ search: 'pork', cursor: 'next-page' }) }));
  act(() => { result.current.setSelectedId('meal'); result.current.setNote('Reviewed the recorded nutrient limits.'); });
  await act(() => result.current.submit());
  expect(api.post).toHaveBeenLastCalledWith('/nutritionist/queue/case/swap', expect.objectContaining({ filters, expectedServingKey: 'c'.repeat(64) }));
});

it('clears the food search on case change and rejects overlong or incomplete criteria without a request', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: preview } });
  const { result, rerender } = renderHook(({ id }) => useReviewSwap(id, true, vi.fn(async () => {}), 'a'.repeat(64)), { initialProps: { id: 'first' } });
  await act(() => result.current.applyFilters({}, 'pork'));
  expect(result.current.searchText).toBe('pork');
  rerender({ id: 'second' });
  expect(result.current.searchText).toBe('');
  await act(() => result.current.applyFilters({}, 'x'.repeat(101)));
  await act(() => result.current.applyFilters({ sodiumMg: { mode: 'max', max: '' } }));
  expect(api.get).toHaveBeenCalledTimes(1);
});

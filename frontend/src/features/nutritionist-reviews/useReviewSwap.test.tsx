import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { useReviewSwap } from './useReviewSwap';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const preview = {
  expectedVersion: 'a'.repeat(64),
  options: [{ id: 'meal', mealName: 'Soup', recipeSignature: 'b'.repeat(64), evidenceRevision: 2, ingredients: [] }],
};
beforeEach(() => vi.resetAllMocks());
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
  const { result } = renderHook(() => useReviewSwap('case', true, success));
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
  expect(result.current.open).toBe(false);
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
  expect(result.current.note).toBe('Recorded review rationale.');
  expect(result.current.selected).toBeNull();
  await act(() => result.current.submit());
  expect(api.post).toHaveBeenCalledTimes(1);
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

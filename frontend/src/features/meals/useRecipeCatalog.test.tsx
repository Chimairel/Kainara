import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useRecipeCatalog } from './useRecipeCatalog';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
const pageData = (page: number, name = `Page ${page} recipe`) => ({
  data: {
    success: true,
    data: {
      items: [{ id: name, name, mealTypes: ['LUNCH'], planningReady: true }],
      total: 12,
      page,
      pageCount: 2,
      restrictedProfile: false,
    },
  },
});
beforeEach(() => vi.clearAllMocks());

it('fetches the selected server page and clears cards while retaining scoped pagination information', async () => {
  let resolveSecond!: (data: ReturnType<typeof pageData>) => void;
  mocks.get.mockResolvedValueOnce(pageData(1)).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveSecond = resolve;
      })
  );
  const { result, rerender } = renderHook(
    ({ page }) => useRecipeCatalog({ ownerId: 'member-a', search: '', mealType: 'All', page }),
    { initialProps: { page: 1 } }
  );
  await waitFor(() => expect(result.current.data?.page).toBe(1));
  rerender({ page: 2 });
  expect(result.current.data).toBeNull();
  expect(result.current.loading).toBe(true);
  expect(result.current.summary?.pageCount).toBe(2);
  await waitFor(() => expect(mocks.get).toHaveBeenCalledWith('/user/meals/verified-recipes', { params: { page: 2 } }));
  await act(async () => resolveSecond(pageData(2)));
  expect(result.current.data?.items[0].name).toBe('Page 2 recipe');
});

it('ignores delayed results from a previous account and filter', async () => {
  let resolveOld!: (data: ReturnType<typeof pageData>) => void;
  mocks.get
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        })
    )
    .mockResolvedValueOnce(pageData(1, 'New account recipe'));
  const { result, rerender } = renderHook(
    ({ ownerId, search }) => useRecipeCatalog({ ownerId, search, mealType: 'LUNCH', page: 1 }),
    { initialProps: { ownerId: 'old-member', search: 'old' } }
  );
  await waitFor(() => expect(mocks.get).toHaveBeenCalledTimes(1));
  rerender({ ownerId: 'new-member', search: 'new' });
  expect(result.current.summary).toBeNull();
  await waitFor(() => expect(result.current.data?.items[0].name).toBe('New account recipe'));
  await act(async () => resolveOld(pageData(1, 'Old account recipe')));
  expect(result.current.data?.items[0].name).toBe('New account recipe');
});

it('recovers after a failed request and leaves hidden libraries idle', async () => {
  mocks.get.mockRejectedValueOnce(new Error('Unavailable')).mockResolvedValueOnce(pageData(1));
  const { result, rerender } = renderHook(
    ({ enabled }) => useRecipeCatalog({ ownerId: 'member', search: '', mealType: 'All', page: 1, enabled }),
    { initialProps: { enabled: false } }
  );
  expect(result.current.loading).toBe(false);
  expect(mocks.get).not.toHaveBeenCalled();
  rerender({ enabled: true });
  await waitFor(() => expect(result.current.error).toBeTruthy());
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.data?.page).toBe(1));
  expect(result.current.error).toBeNull();
});

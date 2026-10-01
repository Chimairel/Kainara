import { clearSessionResourceCache, readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionQuery } from './useSessionQuery';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('shared session queries', () => {
  beforeEach(clearSessionResourceCache);

  it('updates an already rendered result after a shared live event without navigation', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(['pending']).mockResolvedValueOnce(['approved']);
    const hook = renderHook(() =>
      useSessionQuery({ ownerId: 'user', resource: 'live-review', fetcher, errorMessage: 'Unavailable' })
    );
    await waitFor(() => expect(hook.result.current.data).toEqual(['pending']));
    await act(async () => {
      window.dispatchEvent(new Event('kainara:live-update'));
    });
    await waitFor(() => expect(hook.result.current.data).toEqual(['approved']));
    expect(hook.result.current.isLoading).toBe(false);
  });

  it('shares an in-flight request between mounted consumers and treats an empty result as loaded', async () => {
    const request = deferred<string[]>();
    const fetcher = vi.fn(() => request.promise);
    const options = { ownerId: 'user', resource: 'list', fetcher, errorMessage: 'Unavailable' };
    const first = renderHook(() => useSessionQuery(options));
    const second = renderHook(() => useSessionQuery(options));
    expect(fetcher).toHaveBeenCalledOnce();
    await act(async () => request.resolve([]));
    expect(first.result.current.data).toEqual([]);
    expect(second.result.current.isLoading).toBe(false);
  });

  it('keeps cached content visible when background revalidation fails', async () => {
    writeSessionResource('user', 'list', ['cached']);
    const request = deferred<string[]>();
    const hook = renderHook(() =>
      useSessionQuery({
        ownerId: 'user',
        resource: 'list',
        fetcher: () => request.promise,
        errorMessage: 'Unavailable',
      })
    );
    expect(hook.result.current.data).toEqual(['cached']);
    expect(hook.result.current.isLoading).toBe(false);
    await act(async () => request.reject(new Error('Unavailable')));
    expect(hook.result.current.error).toBe('Unavailable');
    expect(hook.result.current.data).toEqual(['cached']);
  });

  it('does not display a previous account or accept its late response', async () => {
    const old = deferred<string[]>();
    const hook = renderHook(
      ({ ownerId }) =>
        useSessionQuery({
          ownerId,
          resource: 'list',
          fetcher: () => (ownerId === 'old' ? old.promise : Promise.resolve(['new'])),
          errorMessage: 'Unavailable',
        }),
      { initialProps: { ownerId: 'old' } }
    );
    hook.rerender({ ownerId: 'new' });
    await waitFor(() => expect(hook.result.current.data).toEqual(['new']));
    await act(async () => old.resolve(['old private data']));
    expect(hook.result.current.data).toEqual(['new']);
    hook.rerender({ ownerId: '' });
    expect(hook.result.current.data).toBeNull();
  });

  it('ignores a late result from the previous filter', async () => {
    const old = deferred<string[]>();
    const hook = renderHook(
      ({ resource }) =>
        useSessionQuery({
          ownerId: 'user',
          resource,
          fetcher: () => (resource === 'all' ? old.promise : Promise.resolve(['filtered'])),
          errorMessage: 'Unavailable',
        }),
      { initialProps: { resource: 'all' } }
    );
    hook.rerender({ resource: 'filtered' });
    await waitFor(() => expect(hook.result.current.data).toEqual(['filtered']));
    await act(async () => old.resolve(['all']));
    expect(hook.result.current.data).toEqual(['filtered']);
  });

  it('keeps a local mutation ahead of an older read in the UI and cache', async () => {
    const old = deferred<string[]>();
    const hook = renderHook(() =>
      useSessionQuery({ ownerId: 'user', resource: 'list', fetcher: () => old.promise, errorMessage: 'Unavailable' })
    );
    act(() => hook.result.current.setData(['mutated']));
    await act(async () => old.resolve(['outdated']));
    expect(hook.result.current.data).toEqual(['mutated']);
    expect(readSessionResource('user', 'list')).toEqual(['mutated']);
  });

  it('does not fetch an inactive workspace and clears loading after an initial error', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Unavailable'));
    const hook = renderHook(
      ({ enabled }) =>
        useSessionQuery<string[]>({ ownerId: 'user', resource: 'list', enabled, fetcher, errorMessage: 'Unavailable' }),
      { initialProps: { enabled: false } }
    );
    expect(fetcher).not.toHaveBeenCalled();
    hook.rerender({ enabled: true });
    await waitFor(() => expect(hook.result.current.error).toBe('Unavailable'));
    expect(hook.result.current.isLoading).toBe(false);
  });
});

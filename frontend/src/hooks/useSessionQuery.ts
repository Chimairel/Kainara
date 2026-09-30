import { getApiErrorMessage } from '@/lib/api-error';
import { readSessionResource, refreshSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { useCallback, useEffect, useRef, useState } from 'react';

type QueryState<T> = { scope: string; data: T | null; loading: boolean; error: string | null };

/** Account-scoped presentation cache. Server authorization and action guards remain authoritative. */
export function useSessionQuery<T>({
  ownerId,
  resource,
  fetcher,
  errorMessage,
  enabled = true,
}: {
  ownerId: string | undefined;
  resource: string;
  fetcher: () => Promise<T>;
  errorMessage: string;
  enabled?: boolean;
}) {
  const scope = JSON.stringify([ownerId, resource]);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestSequence = useRef(0);
  const mounted = useRef(false);
  const [state, setState] = useState<QueryState<T>>(() => {
    const data = readSessionResource<T>(ownerId, resource);
    return { scope, data, loading: Boolean(ownerId && enabled && data === null), error: null };
  });
  const cached = state.scope === scope ? state.data : readSessionResource<T>(ownerId, resource);

  const refetch = useCallback(async () => {
    if (!ownerId || !mounted.current || activeScope.current !== scope) return;
    const sequence = ++requestSequence.current;
    const data = readSessionResource<T>(ownerId, resource);
    setState((previous) => ({
      scope,
      data: data ?? (previous.scope === scope ? previous.data : null),
      loading: data === null && !(previous.scope === scope && previous.data !== null),
      error: null,
    }));
    try {
      const value = await refreshSessionResource(ownerId, resource, () => fetcherRef.current());
      if (mounted.current && activeScope.current === scope && requestSequence.current === sequence) {
        setState({ scope, data: value, loading: false, error: null });
      }
      return value;
    } catch (error) {
      if (mounted.current && activeScope.current === scope && requestSequence.current === sequence) {
        setState((previous) => ({ ...previous, loading: false, error: getApiErrorMessage(error, errorMessage) }));
      }
    }
  }, [ownerId, resource, scope, errorMessage]);

  useEffect(() => {
    mounted.current = true;
    if (enabled) void refetch();
    return () => {
      mounted.current = false;
      requestSequence.current += 1;
    };
  }, [enabled, refetch]);

  const setData = useCallback(
    (value: T) => {
      if (!mounted.current || activeScope.current !== scope) return;
      requestSequence.current += 1;
      writeSessionResource(ownerId, resource, value);
      setState({ scope, data: value, loading: false, error: null });
    },
    [ownerId, resource, scope]
  );
  const setError = useCallback(
    (error: string | null) => {
      if (!mounted.current || activeScope.current !== scope) return;
      setState((previous) =>
        previous.scope === scope
          ? { ...previous, error }
          : {
              scope,
              data: readSessionResource<T>(ownerId, resource),
              loading: false,
              error,
            }
      );
    },
    [ownerId, resource, scope]
  );

  return {
    data: cached,
    isLoading: state.scope === scope ? state.loading : Boolean(ownerId && enabled && cached === null),
    error: state.scope === scope ? state.error : null,
    refetch,
    setData,
    setError,
  };
}

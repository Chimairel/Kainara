import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { api } from './client';
import type { Envelope } from './contracts';
import { message } from './session';

/** Focus-triggered reads only; no background polling or persisted health cache. */
export function useResource<T>(path: string | null) {
  const [response, setResponse] = useState<Envelope<T> | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(false);
  const revision = useRef(0);
  const reload = useCallback(async () => {
    if (!path) {
      setResponse(null);
      setLoading(false);
      return;
    }
    const current = ++revision.current;
    setLoading(true);
    setError(null);
    try {
      const result = await api.request<T>(path);
      if (alive.current && current === revision.current) setResponse(result);
    } catch (cause) {
      if (alive.current && current === revision.current) {
        setError(message(cause));
        setResponse(null);
      }
    } finally {
      if (alive.current && current === revision.current) setLoading(false);
    }
  }, [path]);
  useFocusEffect(
    useCallback(() => {
      alive.current = true;
      void reload();
      return () => {
        alive.current = false;
        revision.current++;
      };
    }, [reload])
  );
  return { data: response?.data ?? null, meta: response?.meta, loading, error, reload };
}

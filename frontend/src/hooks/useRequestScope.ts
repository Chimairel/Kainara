import { useCallback, useEffect, useRef } from 'react';

/** Fence local state/cache writes after a workspace changes owner or unmounts. */
export function useRequestScope(scope: string) {
  const active = useRef({ scope, generation: 0, mounted: false });
  if (active.current.scope !== scope) {
    active.current.scope = scope;
    active.current.generation += 1;
  }
  useEffect(() => {
    const current = active.current;
    current.mounted = true;
    return () => {
      current.mounted = false;
      current.generation += 1;
    };
  }, [scope]);
  return useCallback(() => {
    const generation = active.current.generation;
    return () => active.current.mounted && active.current.scope === scope && active.current.generation === generation;
  }, [scope]);
}

interface SessionResourceEntry<T> {
  cachedAt: number;
  value: T;
}

const DEFAULT_MAX_AGE_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 80;
const entries = new Map<string, SessionResourceEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();
const generations = new Map<string, number>();
let cacheEpoch = 0;

const cacheKey = (ownerId: string, resource: string) => `${ownerId}:${resource}`;

/**
 * Keeps recently rendered, authenticated API data available while the user
 * navigates between client routes. This cache is deliberately memory-only:
 * it is cleared by a page reload and never writes health data to web storage.
 */
export function readSessionResource<T>(
  ownerId: string | undefined,
  resource: string,
  maxAgeMs = DEFAULT_MAX_AGE_MS
): T | null {
  if (!ownerId) return null;

  const key = cacheKey(ownerId, resource);
  const entry = entries.get(key) as SessionResourceEntry<T> | undefined;
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > maxAgeMs) {
    entries.delete(key);
    if (!pending.has(key)) generations.delete(key);
    return null;
  }

  return entry.value;
}

export function writeSessionResource<T>(ownerId: string | undefined, resource: string, value: T): void {
  if (!ownerId) return;
  const key = cacheKey(ownerId, resource);
  // A local mutation must win over a slower read started before it.
  generations.set(key, (generations.get(key) ?? 0) + 1);
  pending.delete(key);
  setEntry(key, value);
}

function setEntry<T>(key: string, value: T): void {
  entries.delete(key);
  entries.set(key, { cachedAt: Date.now(), value });
  if (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value!;
    entries.delete(oldest);
    if (!pending.has(oldest)) generations.delete(oldest);
  }
}

/** Shares a live request across mounted pages without persisting private data in browser storage. */
export function refreshSessionResource<T>(
  ownerId: string | undefined,
  resource: string,
  fetcher: () => Promise<T>
): Promise<T> {
  if (!ownerId) return fetcher();
  const key = cacheKey(ownerId, resource);
  const existing = pending.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const generation = generations.get(key) ?? 0;
  const epoch = cacheEpoch;
  const request = fetcher().then((value) => {
    if (cacheEpoch === epoch && (generations.get(key) ?? 0) === generation) {
      setEntry(key, value);
    }
    return value;
  }).finally(() => {
    if (pending.get(key) === request) pending.delete(key);
    if (!pending.has(key) && !entries.has(key)) generations.delete(key);
  });
  pending.set(key, request);
  return request;
}

export function invalidateSessionResource(ownerId: string | undefined, resource: string): void {
  if (!ownerId) return;
  const key = cacheKey(ownerId, resource);
  const hadPending = pending.has(key);
  entries.delete(key);
  pending.delete(key);
  if (hadPending) generations.set(key, (generations.get(key) ?? 0) + 1);
  else generations.delete(key);
}

export function clearSessionResourceCache(): void {
  cacheEpoch += 1;
  entries.clear();
  pending.clear();
  generations.clear();
}

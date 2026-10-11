/** Process-local stable catalogue data only. Never use for claims or authorization. */
export const CATALOGUE_MATCHING_TTL_MS = 10 * 60_000;
let generation = 0;
export function invalidateCatalogueMatching() {
  generation++;
}
export function catalogueMatchingCache<T>(load: () => Promise<T>, usable: (value: T) => boolean) {
  let saved: { value: T; generation: number; until: number } | undefined;
  let pending: { generation: number; promise: Promise<T> } | undefined;
  return async (): Promise<T> => {
    const current = generation;
    if (saved?.generation === current && saved.until > Date.now()) return saved.value;
    if (pending?.generation === current) return pending.promise;
    const promise = load().then((value) => {
      if (generation === current && usable(value))
        saved = { value, generation: current, until: Date.now() + CATALOGUE_MATCHING_TTL_MS };
      return value;
    });
    pending = { generation: current, promise };
    try {
      return await promise;
    } finally {
      if (pending?.promise === promise) pending = undefined;
    }
  };
}

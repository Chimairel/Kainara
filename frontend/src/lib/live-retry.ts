/** Back off failed streams and respect the server's Retry-After cooldown. */
export function liveRetryDelay(failures: number, retryAfter?: string | null, now = Date.now()): number {
  const backoff = Math.min(60_000, 3000 * 2 ** Math.min(Math.max(failures - 1, 0), 5));
  if (!retryAfter) return backoff;
  const seconds = /^\d+(?:\.\d+)?$/.test(retryAfter.trim()) ? Number(retryAfter) : null;
  const requested = seconds === null ? Date.parse(retryAfter) - now : seconds * 1000;
  return Number.isFinite(requested) ? Math.max(backoff, Math.min(300_000, requested)) : backoff;
}

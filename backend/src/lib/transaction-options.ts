/** Bounded defaults for remote database round trips; per-operation isolation and longer limits remain overrides. */
export const DATABASE_TRANSACTION_OPTIONS = { maxWait: 10_000, timeout: 30_000 } as const;

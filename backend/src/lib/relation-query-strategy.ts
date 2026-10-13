const relationReads = new Set(['findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany']);

/** Enable joins only on explicitly profiled reads; preserve existing reads elsewhere.
 * Joined primary-key reads use findFirst to avoid Prisma 5's mixed-strategy findUnique batching panic.
 */
export function preserveRelationQueryStrategy<T>(operation: string, args: T): T {
  if (!relationReads.has(operation) || !args || typeof args !== 'object') return args;
  return { relationLoadStrategy: 'query', ...args };
}

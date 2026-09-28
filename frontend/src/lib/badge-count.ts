export function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(Math.max(0, count));
}

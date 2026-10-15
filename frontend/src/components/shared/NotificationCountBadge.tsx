import { formatBadgeCount } from '@/lib/badge-count';

/** The bell's unread-count badge, also used by review tabs. */
export default function NotificationCountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span aria-hidden="true" className="absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[8px] font-bold text-[#07100d] ring-2 ring-brand-bg shadow-sm">
      {formatBadgeCount(count)}
    </span>
  );
}

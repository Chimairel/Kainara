/** Shared unread-activity mark for the notification bell and review tabs. */
export default function NotificationActivityDot() {
  return <span aria-hidden="true" className="pointer-events-none absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-brand-surface dark:ring-[#0c1813] motion-safe:animate-pulse" />;
}

import React, { useState, useRef, useEffect } from 'react';
import NotificationActivityDot from './NotificationActivityDot';
import NotificationCountBadge from './NotificationCountBadge';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { formatManilaDate } from '@/lib/manila-date';
import {
  CheckCircle,
  AlertTriangle,
  ClipboardList,
  Calendar,
  Bell,
  Inbox,
  Sprout,
  CheckCheck,
  Volume2,
  VolumeX,
} from '@/components/ui/icons';
import Modal from '@/components/ui/Modal';
import DeviceNotificationsPanel from '@/features/meal-reminders/DeviceNotificationsPanel';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return formatManilaDate(date, {
    month: 'short',
    day: 'numeric',
  });
}

export default function NotificationDropdown() {
  const router = useRouter();
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, soundEnabled, toggleNotificationSound } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const getIconForType = (type: string) => {
    switch (type) {
      case 'PLAN_APPROVED':
      case 'OUTSIDE_MEAL_REVIEWED':
      case 'FLAG_RESOLVED':
        return <CheckCircle className="h-6 w-6 text-status-verified-text" />;
      case 'ASSIGNMENT':
      case 'MEMBERSHIP_UPDATED':
        return <Sprout className="h-6 w-6" />;
      case 'PLAN_REJECTED':
      case 'MEAL_FLAGGED':
        return <AlertTriangle className="h-6 w-6 text-status-error-text" />;
      case 'OUTSIDE_MEAL_MORE_INFO':
      case 'NUTRITIONIST_APPLICATION':
      case 'REVIEW_REQUEST':
        return <ClipboardList className="h-6 w-6" />;
      case 'WEEKLY_CHECKIN':
        return <Calendar className="h-6 w-6" />;
      default:
        return <Bell className="h-6 w-6" />;
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-10 w-10 items-center justify-center rounded-full text-brand-muted hover:text-brand-text active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
        aria-label="View notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-6 w-6 transition-transform duration-200 group-hover:rotate-12" />

        <NotificationCountBadge count={unreadCount} />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[min(34rem,calc(100dvh-11rem))] w-[min(24rem,calc(100vw-2.5rem))] sm:max-h-[min(34rem,calc(100dvh-7rem))] sm:w-[26rem] flex-col overflow-hidden rounded-2xl border border-brand-border/90 bg-brand-surface p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all duration-150 dark:border-[#173e33] dark:bg-[#0c1813]/95 dark:shadow-[0_25px_60px_rgba(0,0,0,0.65)] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex shrink-0 flex-col gap-2 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                <Bell className="h-6 w-6" />
                {unreadCount > 0 && (
                  <NotificationActivityDot />
                )}
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-brand-text dark:text-white/95">Notifications</h3>
                <p className="mt-0.5 truncate text-xs text-brand-muted dark:text-white/55">
                  {unreadCount > 0
                    ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
                    : 'All caught up with updates'}
                </p>
              </div>
            </div>
            <div
              role="group"
              aria-label="Notification controls"
              className="flex shrink-0 items-center gap-1 border-t border-brand-border/60 pt-1 sm:border-0 sm:pt-0"
            >
              <button
                type="button"
                className="mr-auto min-h-11 whitespace-nowrap rounded-lg px-2 text-xs font-semibold text-brand-green hover:bg-brand-bgAlt/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green sm:mr-0 sm:text-[10px]"
                onClick={() => {
                  setIsOpen(false);
                  setDeviceSettingsOpen(true);
                }}
              >
                Device alerts
              </button>
              <button
                type="button"
                role="switch"
                aria-label="Notification sound"
                aria-checked={soundEnabled}
                title={soundEnabled ? 'Mute notification sound' : 'Enable and preview notification sound'}
                onClick={toggleNotificationSound}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-brand-muted transition hover:bg-brand-bgAlt/70 hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                {soundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  aria-label="Mark all notifications as read"
                  title="Mark all notifications as read"
                  className="group flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-semibold text-brand-muted transition hover:bg-brand-bgAlt/70 hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green active:scale-95 dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-emerald-400"
                >
                  <CheckCheck className="h-5 w-5 text-brand-muted transition group-hover:text-brand-green dark:text-white/60 dark:group-hover:text-emerald-400" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
            </div>
          </div>

          <div className="my-1 h-px bg-brand-border/60 dark:bg-white/[0.07]" />

          <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 py-1 space-y-1.5">
            {isLoading ? (
              <div className="space-y-1.5 py-1" aria-label="Loading notifications">
                {[0, 1, 2].map((item) => (
                  <div
                    key={item}
                    className="h-16 animate-pulse rounded-xl border border-brand-border/40 bg-brand-bgAlt/50 dark:border-white/[0.05] dark:bg-white/[0.03]"
                  />
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center">
                  <Inbox className="h-8 w-8" />
                </span>
                <div>
                  <p className="text-xs font-bold text-brand-text dark:text-white/90">No notifications yet</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-brand-muted dark:text-white/45 max-w-[200px]">
                    Updates regarding meal approvals and check-ins will show up here.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.map((notif) => {
                  const icon = getIconForType(notif.type);
                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => {
                        if (!notif.isRead) void markAsRead(notif.id).catch(() => undefined);
                        if (notif.type === 'MEAL_REMINDER' && notif.targetPath?.startsWith('/meals?date=')) {
                          setIsOpen(false);
                          router.push(notif.targetPath);
                        } else if (notif.type === 'NUTRITIONIST_APPLICATION' && user?.role === 'ADMIN') {
                          setIsOpen(false);
                          router.push('/admin/users?tab=nutritionists');
                        } else if (notif.type === 'REVIEW_REQUEST' && user?.role === 'NUTRITIONIST') {
                          setIsOpen(false);
                          router.push('/nutritionist/reviews');
                        } else if (
                          notif.type === 'REVIEW_REQUEST' &&
                          user?.role === 'USER' &&
                          notif.targetPath === '/profile/clinical-evidence'
                        ) {
                          setIsOpen(false);
                          router.push('/profile/clinical-evidence');
                        }
                      }}
                      className={`group relative flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left outline-none transition hover:bg-brand-bgAlt/70 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                        !notif.isRead
                          ? 'border border-brand-green/25 bg-brand-green/[0.04] dark:border-emerald-500/25 dark:bg-emerald-500/[0.06]'
                          : 'border border-transparent'
                      }`}
                    >
                      <span data-notification-icon className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center">
                        {icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-1.5">
                          <span
                            className={`min-w-0 text-xs font-semibold leading-snug line-clamp-2 sm:line-clamp-1 ${
                              !notif.isRead
                                ? 'text-brand-text dark:text-white/95'
                                : 'text-brand-muted dark:text-white/60'
                            }`}
                          >
                            {notif.title}
                          </span>
                          <span className="shrink-0 flex items-center gap-1.5">
                            <span className="font-mono text-[9px] font-medium text-brand-muted/70 dark:text-white/40">
                              {formatRelativeTime(notif.createdAt)}
                            </span>
                            {!notif.isRead && (
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                            )}
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-3 break-words text-xs leading-relaxed text-brand-muted dark:text-white/55 sm:line-clamp-2 sm:text-[11px]">
                          {notif.message}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <Modal isOpen={deviceSettingsOpen} onClose={() => setDeviceSettingsOpen(false)} title="Device notifications">
        {deviceSettingsOpen && <DeviceNotificationsPanel />}
      </Modal>
    </div>
  );
}

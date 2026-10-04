import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import {
  CheckCircle,
  AlertTriangle,
  ClipboardList,
  Calendar,
  Bell,
  Inbox,
  ShieldCheck,
  AlertCircle,
  ArrowRight,
  Sprout,
  CheckCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import api from '@/lib/axios';
import { readSessionResource } from '@/lib/session-resource-cache';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';
import type { PlanningReadiness } from '@/types/planning-readiness';
import { formatBadgeCount } from '@/lib/badge-count';

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

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

interface CachedPlanInfo {
  isStarterPlan?: boolean;
  nextCycleDay?: string | null;
  cycles?: {
    current?: { planType?: string; endDate?: string | Date } | null;
    upcoming?: { startDate?: string | Date } | null;
  } | null;
  cycle?: { planType?: string; endDate?: string | Date } | null;
  meals?: Array<{ planType?: string }>;
  pendingReview?: { planType?: string } | null;
}

export default function NotificationDropdown() {
  const router = useRouter();
  const { user } = useAuth();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, soundEnabled, toggleNotificationSound } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const [planningReadiness, setPlanningReadiness] = useState<PlanningReadiness | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOnboardingDone = Boolean(user?.onboardingDone);
  const isTosAccepted = Boolean(user?.tosAccepted);
  const isReportAcknowledged = Boolean(user?.reportAcknowledged);
  const prerequisitesComplete = isOnboardingDone && isTosAccepted && isReportAcknowledged;
  const isPlanningReady = prerequisitesComplete && planningReadiness?.canRequestPlan === true;

  useEffect(() => {
    if (!isOpen || user?.role !== 'USER' || !prerequisitesComplete) return;
    let active = true;
    setPlanningReadiness(null);
    api
      .get('/user/meals/readiness')
      .then((response) => {
        if (active && response.data?.success) setPlanningReadiness(response.data.data);
      })
      .catch(() => {
        if (active) setPlanningReadiness(null);
      });
    return () => {
      active = false;
    };
  }, [isOpen, user?.role, user?.userId, prerequisitesComplete]);

  const [cycleInfo, setCycleInfo] = useState<{ isStarterPlan: boolean; nextCycleDay: string | null } | null>(() => {
    const cached =
      readSessionResource<CachedPlanInfo>(user?.userId, 'user-meals-current') ||
      readSessionResource<CachedPlanInfo>(user?.userId, 'user-meals-workspace') ||
      readSessionResource<CachedPlanInfo>(user?.userId, 'current-meal-plan');
    if (cached) {
      const isStarter =
        cached.isStarterPlan ??
        (cached.cycles?.current?.planType === 'STARTER' ||
          cached.cycle?.planType === 'STARTER' ||
          cached.meals?.[0]?.planType === 'STARTER' ||
          cached.pendingReview?.planType === 'STARTER');
      const nextDay =
        cached.nextCycleDay ??
        (cached.cycles?.upcoming?.startDate
          ? formatManilaDate(manilaDateFromKey(getManilaDateKey(cached.cycles.upcoming.startDate)), {
              weekday: 'long',
              month: 'short',
              day: 'numeric',
            })
          : null);
      return { isStarterPlan: Boolean(isStarter), nextCycleDay: nextDay };
    }
    return null;
  });

  useEffect(() => {
    if (isOpen && user?.role === 'USER') {
      const cached =
        readSessionResource<CachedPlanInfo>(user?.userId, 'user-meals-current') ||
        readSessionResource<CachedPlanInfo>(user?.userId, 'user-meals-workspace') ||
        readSessionResource<CachedPlanInfo>(user?.userId, 'current-meal-plan');
      if (cached) {
        const isStarter =
          cached.isStarterPlan ??
          (cached.cycles?.current?.planType === 'STARTER' ||
            cached.cycle?.planType === 'STARTER' ||
            cached.meals?.[0]?.planType === 'STARTER' ||
            cached.pendingReview?.planType === 'STARTER');
        const nextDay =
          cached.nextCycleDay ??
          (cached.cycles?.upcoming?.startDate
            ? formatManilaDate(manilaDateFromKey(getManilaDateKey(cached.cycles.upcoming.startDate)), {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
              })
            : null);
        setCycleInfo({ isStarterPlan: Boolean(isStarter), nextCycleDay: nextDay });
      } else {
        api
          .get('/user/meals/cycles')
          .then((res) => {
            if (res.data?.success && res.data?.data) {
              const { current, upcoming } = res.data.data;
              const isStarter = current?.planType === 'STARTER';
              let nextDay: string | null = null;
              if (upcoming?.startDate) {
                nextDay = formatManilaDate(manilaDateFromKey(getManilaDateKey(upcoming.startDate)), {
                  weekday: 'long',
                  month: 'short',
                  day: 'numeric',
                });
              } else if (current?.endDate) {
                const dayAfter = new Date(current.endDate);
                dayAfter.setDate(dayAfter.getDate() + 1);
                nextDay = formatManilaDate(dayAfter, { weekday: 'long', month: 'short', day: 'numeric' });
              }
              setCycleInfo({ isStarterPlan: Boolean(isStarter), nextCycleDay: nextDay });
            }
          })
          .catch(() => {
            // silent fallback
          });
      }
    }
  }, [isOpen, user?.role, user?.userId]);

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
        return {
          icon: <CheckCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />,
          surface:
            'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
        };
      case 'ASSIGNMENT':
      case 'MEMBERSHIP_UPDATED':
        return {
          icon: <Sprout className="w-3.5 h-3.5 text-brand-green dark:text-emerald-400" />,
          surface:
            'bg-brand-green/10 border-brand-green/20 text-brand-green dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
        };
      case 'PLAN_REJECTED':
      case 'MEAL_FLAGGED':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />,
          surface:
            'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:bg-rose-500/15 dark:border-rose-500/30 dark:text-rose-400',
        };
      case 'OUTSIDE_MEAL_MORE_INFO':
      case 'NUTRITIONIST_APPLICATION':
      case 'REVIEW_REQUEST':
        return {
          icon: <ClipboardList className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />,
          surface:
            'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-400',
        };
      case 'WEEKLY_CHECKIN':
        return {
          icon: <Calendar className="w-3.5 h-3.5 text-brand-green dark:text-emerald-400" />,
          surface:
            'bg-brand-green/10 border-brand-green/20 text-brand-green dark:bg-emerald-500/15 dark:border-emerald-500/30 dark:text-emerald-400',
        };
      default:
        return {
          icon: <Bell className="w-3.5 h-3.5 text-brand-muted dark:text-white/50" />,
          surface:
            'bg-brand-bgAlt border-brand-border/60 text-brand-muted dark:bg-white/[0.05] dark:border-white/[0.08] dark:text-white/60',
        };
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex h-10 w-10 items-center justify-center rounded-full text-brand-muted hover:text-brand-text hover:bg-black/[0.05] dark:hover:bg-white/[0.08] active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-brand-green/40"
        aria-label="View notifications"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5 transition-transform duration-200 group-hover:rotate-12" />

        {unreadCount > 0 ? (
          <span className="absolute -top-0.5 -right-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[8px] font-bold text-[#07100d] ring-2 ring-brand-bg shadow-sm">
            {formatBadgeCount(unreadCount)}
          </span>
        ) : user?.role === 'USER' && (!prerequisitesComplete || planningReadiness?.canRequestPlan === false) ? (
          <span className="absolute 1 top-1 flex h-2 w-2 rounded-full bg-amber-500 ring-2 ring-brand-bg shadow-sm" />
        ) : null}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-[calc(100%+8px)] z-50 flex max-h-[min(34rem,calc(100vh-5.5rem))] w-[min(24rem,calc(100vw-1.5rem))] sm:w-[26rem] flex-col overflow-hidden rounded-2xl border border-brand-border/90 bg-brand-surface p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all duration-150 dark:border-[#173e33] dark:bg-[#0c1813]/95 dark:shadow-[0_25px_60px_rgba(0,0,0,0.65)] animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-brand-green/20 bg-brand-green/10 text-brand-green dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-400">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-brand-surface dark:ring-[#0c1813] animate-pulse" />
                )}
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-brand-text dark:text-white/95">Notifications</h3>
                  {unreadCount > 0 && (
                    <span className="rounded-full border border-brand-green/25 bg-brand-green/15 px-1.5 py-0.2 font-mono text-[9px] font-bold text-brand-green dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <p className="truncate text-[10px] font-medium text-brand-muted dark:text-white/45">
                  {unreadCount > 0
                    ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}`
                    : 'All caught up with updates'}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                role="switch"
                aria-label="Notification sound"
                aria-checked={soundEnabled}
                title={soundEnabled ? 'Mute notification sound' : 'Enable notification sound'}
                onClick={toggleNotificationSound}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-brand-muted transition hover:bg-brand-bgAlt/70 hover:text-brand-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green dark:text-white/50 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  aria-label="Mark all notifications as read"
                  title="Mark all notifications as read"
                  className="group flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-brand-muted transition hover:bg-brand-bgAlt/70 hover:text-brand-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green active:scale-95 dark:text-white/60 dark:hover:bg-white/[0.06] dark:hover:text-emerald-400"
                >
                  <CheckCheck className="h-3 w-3 text-brand-muted transition group-hover:text-brand-green dark:text-white/50 dark:group-hover:text-emerald-400" />
                  <span className="hidden sm:inline">Mark read</span>
                </button>
              )}
            </div>
          </div>

          <div className="my-1 h-px bg-brand-border/60 dark:bg-white/[0.07]" />

          <div className="custom-scrollbar flex-1 overflow-y-auto px-1 py-1 space-y-1.5">
            {/* Planner Status Section */}
            {user?.role === 'USER' && (
              <div
                className={`rounded-xl border p-2.5 text-left transition-all ${
                  isPlanningReady
                    ? 'border-brand-green/20 bg-brand-green/[0.04] dark:border-[#173e33] dark:bg-emerald-950/20'
                    : 'border-amber-500/25 bg-amber-500/[0.06] dark:border-amber-500/30 dark:bg-amber-950/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${
                        isPlanningReady
                          ? 'border-brand-green/20 bg-brand-green/10 text-brand-green dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400'
                          : 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400'
                      }`}
                    >
                      {isPlanningReady ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <AlertCircle className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-brand-text dark:text-white/95 truncate">
                          Planner Status
                        </h4>
                        <span
                          className={`inline-block h-1.5 w-1.5 rounded-full ${
                            isPlanningReady ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
                          }`}
                        />
                      </div>
                      <span className="text-[10px] text-brand-muted dark:text-white/45 truncate block">
                        {planningReadiness?.title ||
                          (prerequisitesComplete ? 'Checking clinical readiness' : 'Action required')}
                      </span>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider border ${
                      isPlanningReady
                        ? 'border-brand-green/30 bg-brand-green/10 text-brand-green dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400'
                        : 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400'
                    }`}
                  >
                    {isPlanningReady ? 'Ready' : planningReadiness?.canRequestPlan === false ? 'Blocked' : 'Pending'}
                  </span>
                </div>

                <p className="mt-1.5 text-[11px] leading-relaxed text-brand-muted dark:text-white/60">
                  {prerequisitesComplete
                    ? planningReadiness?.message || 'Checking current clinical context and meal-planning requirements.'
                    : !isReportAcknowledged
                      ? 'Please review and acknowledge your personalized nutrition report before meal plans can be generated or viewed.'
                      : !isTosAccepted
                        ? 'Please accept the clinical disclaimer and Terms of Service to enable meal planning.'
                        : 'Please complete your health intake onboarding to enable personalized meal planning.'}
                </p>

                {(!isPlanningReady || planningReadiness?.status === 'REQUEST_ALLOWED_REVIEW_EXPECTED') && (
                  <div className="mt-2 pt-1.5 border-t border-brand-border/40 dark:border-white/[0.06]">
                    {planningReadiness && prerequisitesComplete ? (
                      <Link
                        href={planningReadiness.actionPath || '/meals'}
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green hover:underline dark:text-emerald-400"
                      >
                        <span>{planningReadiness.canRequestPlan ? 'View meal plan' : 'Review clinical context'}</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : !isReportAcknowledged ? (
                      <Link
                        href="/profile/nutrition-report"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green hover:underline dark:text-emerald-400"
                      >
                        <span>View nutrition report</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : !isTosAccepted ? (
                      <Link
                        href="/onboarding/tos"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green hover:underline dark:text-emerald-400"
                      >
                        <span>Accept Terms of Service</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : (
                      <Link
                        href="/onboarding/stats"
                        onClick={() => setIsOpen(false)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green hover:underline dark:text-emerald-400"
                      >
                        <span>Complete onboarding</span>
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Starter Plan Status Card */}
            {user?.role === 'USER' && cycleInfo?.isStarterPlan && (
              <div className="rounded-xl border border-brand-green/20 bg-brand-green/[0.04] p-2.5 text-left dark:border-[#173e33] dark:bg-emerald-950/20">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand-green/20 bg-brand-green/10 text-brand-green dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400">
                      <Sprout className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-brand-text dark:text-white/95 truncate">
                        Starter Plan Active
                      </h4>
                      <span className="text-[10px] text-brand-muted dark:text-white/45 truncate block">
                        Kickoff bridge plan
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-green dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400">
                    Starter
                  </span>
                </div>

                <p className="mt-1.5 text-[11px] leading-relaxed text-brand-muted dark:text-white/60">
                  You are currently on a starter bridge plan. Your full 7-day weekly cycle begins{' '}
                  <span className="font-semibold text-brand-text dark:text-white/90">
                    {cycleInfo.nextCycleDay ? `on ${cycleInfo.nextCycleDay}` : 'after this bridge plan ends'}
                  </span>
                  .
                </p>

                <div className="mt-2 pt-1.5 border-t border-brand-border/40 dark:border-white/[0.06]">
                  <Link
                    href="/meals"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-green hover:underline dark:text-emerald-400"
                  >
                    <span>View meal plan</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            )}

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
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-brand-border/60 bg-brand-bgAlt text-brand-muted shadow-xs dark:border-[#173e33] dark:bg-white/[0.04] dark:text-white/40">
                  <Inbox className="h-4 w-4 opacity-70" />
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
                  const meta = getIconForType(notif.type);
                  return (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => {
                        if (!notif.isRead) void markAsRead(notif.id).catch(() => undefined);
                        if (notif.type === 'NUTRITIONIST_APPLICATION' && user?.role === 'ADMIN') {
                          setIsOpen(false);
                          router.push('/admin/users?tab=nutritionists');
                        } else if (notif.type === 'REVIEW_REQUEST' && user?.role === 'NUTRITIONIST') {
                          setIsOpen(false);
                          router.push('/nutritionist/reviews');
                        }
                      }}
                      className={`group relative flex w-full items-start gap-2.5 rounded-xl p-2.5 text-left outline-none transition hover:bg-brand-bgAlt/70 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green ${
                        !notif.isRead
                          ? 'border border-brand-green/25 bg-brand-green/[0.04] dark:border-emerald-500/25 dark:bg-emerald-500/[0.06]'
                          : 'border border-transparent'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${meta.surface} transition-transform group-hover:scale-105`}
                      >
                        {meta.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-1.5">
                          <span
                            className={`text-xs font-semibold leading-snug line-clamp-1 ${
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
                        <span className="mt-0.5 line-clamp-2 block text-[11px] leading-relaxed text-brand-muted dark:text-white/55">
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
    </div>
  );
}

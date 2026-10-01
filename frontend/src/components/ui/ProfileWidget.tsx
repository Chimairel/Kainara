'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  SlidersHorizontal,
  ClipboardList,
  Settings,
  BookOpen,
  LogOut,
  ChevronRight,
  ArrowUpRight,
} from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { useMembership } from '@/features/membership/MembershipProvider';

interface ProfileWidgetProps {
  onClose: () => void;
  className?: string;
}

export default function ProfileWidget({ onClose, className = '' }: ProfileWidgetProps) {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { data: membership } = useMembership();

  if (!user) return null;

  const isUser = user.role === 'USER';
  const profileHref =
    user.role === 'NUTRITIONIST'
      ? '/nutritionist/profile'
      : user.role === 'ADMIN'
        ? '/admin/profile'
        : '/profile/personal';

  const getMembershipSubtitle = () => {
    if (!isUser) {
      return user.role === 'NUTRITIONIST' ? 'Licensed Nutritionist' : 'System Administrator';
    }
    if (!membership || !membership.enabled) return 'Free';
    if (membership.level === 'TRIAL') {
      if (membership.trialEndsAt) {
        const days = Math.max(
          0,
          Math.ceil((new Date(membership.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        );
        return days > 0 ? `Pro · ${days}d left` : 'Pro';
      }
      return 'Pro';
    }
    if (membership.level === 'TRIAL_PENDING') return 'Pro Pending';
    if (membership.level === 'MEMBER') return 'Pro';
    return 'Free';
  };

  const handleNavigate = (href: string) => {
    onClose();
    router.push(href);
  };

  const handleLogout = async () => {
    onClose();
    await logout();
  };

  const needsReportAttention = isUser && user && !user.reportAcknowledged;

  return (
    <div
      role="menu"
      aria-label="User account menu"
      className={`w-72 overflow-hidden rounded-2xl border border-brand-border/90 bg-brand-surface p-1.5 shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition-all duration-150 dark:border-[#173e33] dark:bg-[#0c1813]/95 dark:shadow-[0_25px_60px_rgba(0,0,0,0.65)] ${className}`}
    >
      {/* ─── USER HEADER ROW (Click to view personal profile) ─── */}
      <button
        type="button"
        role="menuitem"
        onClick={() => handleNavigate(profileHref)}
        className="group relative flex w-full items-center gap-3 rounded-xl p-2.5 text-left transition hover:bg-brand-bgAlt/70 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
      >
        {isUser && membership?.enabled && (membership.level === 'TRIAL' || membership.level === 'MEMBER') ? (
          <div className="relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full p-[2px] shadow-xs">
            <span
              className="pointer-events-none absolute inset-[-150%] animate-[spin_4s_linear_infinite]"
              style={{
                background:
                  'conic-gradient(from 0deg, #eb6a38 0deg, #f09e6c 90deg, #10b981 180deg, #34d399 270deg, #eb6a38 360deg)',
              }}
              aria-hidden="true"
            />
            <Avatar
              size="sm"
              src={user.image}
              fallbackText={user.name}
              className="relative z-10 !h-full !w-full rounded-full"
            />
          </div>
        ) : (
          <Avatar
            size="sm"
            src={user.image}
            fallbackText={user.name}
            className="h-9 w-9 rounded-full ring-2 ring-blue-500/40 transition group-hover:ring-blue-500 dark:ring-blue-400/30"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-brand-text group-hover:text-brand-green dark:text-white/95 dark:group-hover:text-emerald-400">
            {user.name}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            {isUser && membership?.enabled && membership.level === 'TRIAL' && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
            <p className="truncate font-mono text-[10px] font-semibold text-brand-muted dark:text-white/45">
              {getMembershipSubtitle()}
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-brand-muted/60 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-text dark:text-white/30" />
      </button>

      {isUser && (
        <>
          <div className="my-1 h-px bg-brand-border/60 dark:bg-white/[0.07]" />

          {/* ─── 1. MEMBERSHIP ─── */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleNavigate('/membership')}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-brand-text transition hover:bg-brand-bgAlt/70 dark:text-white/90 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 stroke-2 text-brand-muted group-hover:text-brand-green dark:text-white/50" />
            <span className="flex-1 truncate">Membership</span>
          </button>

          {/* ─── 2. PERSONALIZATION ─── */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleNavigate('/profile/health')}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-brand-text transition hover:bg-brand-bgAlt/70 dark:text-white/90 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 stroke-2 text-brand-muted group-hover:text-brand-green dark:text-white/50" />
            <span className="flex-1 truncate">Personalization</span>
          </button>

          {/* ─── 3. NUTRITION REPORT ─── */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleNavigate('/profile/nutrition-report')}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-brand-text transition hover:bg-brand-bgAlt/70 dark:text-white/90 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            <ClipboardList className="h-3.5 w-3.5 shrink-0 stroke-2 text-brand-muted group-hover:text-brand-green dark:text-white/50" />
            <span className="flex-1 truncate">Nutrition report</span>
            {needsReportAttention && (
              <Badge variant="pending" className="text-[9px] font-bold px-1.5 py-0">
                Action needed
              </Badge>
            )}
          </button>

          {/* ─── 4. SETTINGS ─── */}
          <button
            type="button"
            role="menuitem"
            onClick={() => handleNavigate('/profile/security')}
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-brand-text transition hover:bg-brand-bgAlt/70 dark:text-white/90 dark:hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            <Settings className="h-3.5 w-3.5 shrink-0 stroke-2 text-brand-muted group-hover:text-brand-green dark:text-white/50" />
            <span className="flex-1 truncate">Settings</span>
          </button>
        </>
      )}

      <div className="my-1 h-px bg-brand-border/60 dark:bg-white/[0.07]" />

      {/* ─── 5. HELP & DOCS ─── */}
      <a
        href="/docs"
        target="_blank"
        rel="noopener noreferrer"
        role="menuitem"
        onClick={() => onClose()}
        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-brand-muted transition hover:bg-brand-bgAlt/70 hover:text-brand-text dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
      >
        <BookOpen className="h-3.5 w-3.5 shrink-0 stroke-2 text-brand-muted group-hover:text-brand-green dark:text-white/50" />
        <span className="flex-1 truncate">Help & Docs</span>
        <ArrowUpRight className="h-3 w-3 shrink-0 text-brand-muted/50 group-hover:text-brand-text dark:text-white/30" />
      </a>

      {/* ─── 6. LOG OUT ─── */}
      <button
        type="button"
        role="menuitem"
        onClick={() => void handleLogout()}
        className="group flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs font-semibold text-red-500 transition hover:bg-red-500/10 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0 stroke-[2.25]" />
        <span className="truncate">Log out</span>
      </button>
    </div>
  );
}

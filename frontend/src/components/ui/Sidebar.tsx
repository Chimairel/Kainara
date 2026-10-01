'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, ArrowUpRight, BookOpen, ChevronUp, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { primaryWorkspaceTools } from '@/lib/workspace-navigation';
import { useAuth } from '@/hooks/useAuth';
import Avatar from '@/components/ui/Avatar';
import KainaraLogo from '@/components/shared/KainaraLogo';
import MotionActiveIndicator from '@/components/ui/motion/MotionActiveIndicator';
import { Dock, DockItem, DockIcon, DockLabel, DockAvatar } from '@/components/ui/motion';
import ProfileWidget from '@/components/ui/ProfileWidget';
import { useMembership } from '@/features/membership/MembershipProvider';

interface SidebarProps {
  className?: string;
}

interface SidebarTooltipProps {
  id: string;
  label: string;
  placement?: 'side' | 'below';
}

const SidebarTooltip: React.FC<SidebarTooltipProps> = ({ id, label, placement = 'side' }) => (
  <span
    id={id}
    role="tooltip"
    className={`
      pointer-events-none absolute z-50 whitespace-nowrap rounded-xl border border-[#173e33] bg-[#071914]/95
      px-3 py-2 font-display text-[11px] font-semibold tracking-tight text-white opacity-0 shadow-[0_12px_34px_rgba(0,0,0,0.38)]
      backdrop-blur-xl transition-all duration-150 group-hover:scale-100 group-hover:opacity-100
      group-focus-within:scale-100 group-focus-within:opacity-100
      ${
        placement === 'side'
          ? 'left-[calc(100%+12px)] top-1/2 -translate-y-1/2 scale-95 origin-left'
          : 'left-0 top-[calc(100%+9px)] -translate-y-1 scale-95'
      }
    `}
  >
    {label}
    <span
      aria-hidden="true"
      className={`absolute h-2 w-2 rotate-45 border border-[#173e33] bg-[#071914] ${
        placement === 'side'
          ? '-left-1 top-1/2 -translate-y-1/2 border-r-0 border-t-0'
          : 'left-4 -top-1 border-b-0 border-r-0'
      }`}
    />
  </span>
);

export const Sidebar: React.FC<SidebarProps> = ({ className = '' }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { data: membership } = useMembership();
  const isPro = Boolean(
    user?.role === 'USER' &&
    membership?.enabled &&
    (membership.level === 'TRIAL' || membership.level === 'MEMBER')
  );
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    setIsCollapsed(localStorage.getItem('nutrimind-sidebar-collapsed') === 'true');
  }, []);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const collapsedMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsProfileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isProfileMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target) &&
        collapsedMenuRef.current &&
        !collapsedMenuRef.current.contains(target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsProfileMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProfileMenuOpen]);

  if (!user) return null;

  const toggleCollapse = () => {
    const nextValue = !isCollapsed;
    setIsCollapsed(nextValue);
    localStorage.setItem('nutrimind-sidebar-collapsed', String(nextValue));
  };

  const navItems = primaryWorkspaceTools[user.role].filter((item) => item.href !== '/profile');
  const collapsed = isMounted && isCollapsed;
  const homeHref =
    user.role === 'USER' ? '/dashboard' : user.role === 'NUTRITIONIST' ? '/nutritionist/reviews' : '/admin/overview';
  const profileHref =
    user.role === 'NUTRITIONIST' ? '/nutritionist/profile' : user.role === 'USER' ? '/profile' : '/admin/profile';
  const profileActive = pathname === profileHref || pathname.startsWith(`${profileHref}/`);
  const roleLabel =
    user.role === 'NUTRITIONIST' ? 'Clinical portal' : user.role === 'ADMIN' ? 'Control center' : 'Personal portal';

  return (
    <aside
      className={`
        relative z-30 hidden h-full shrink-0 flex-col overflow-visible rounded-[30px] border border-[#173e33]
        bg-[linear-gradient(180deg,#0e271f_0%,#0b231c_58%,#071914_100%)] text-white floating-sidebar-shadow
        transition-all duration-300 ease-out md:flex
        ${collapsed ? 'w-[68px] px-2 py-3.5' : 'w-[248px] p-4'}
        ${className}
      `}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[30px]">
        <div className="absolute -right-20 -top-16 h-52 w-52 rounded-full bg-brand-accent/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-brand-cyan/10 blur-3xl" />
      </div>

      {collapsed ? (
        <div className="relative z-10 flex h-full w-full flex-col items-center justify-start py-1">
          {/* 1. TOP GROUP: Logo & Expand Toggle */}
          <div className="flex shrink-0 flex-col items-center pt-0.5">
            <button
              type="button"
              onClick={toggleCollapse}
              aria-label="Open sidebar"
              className="group/sidebar-toggle relative flex h-12 w-12 cursor-ew-resize items-center justify-center rounded-full outline-none transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-brand-green/40"
            >
              <div className="relative flex h-full w-full items-center justify-center rounded-full overflow-hidden">
                <KainaraLogo className="h-12 w-12 transition-all duration-150 group-hover/sidebar-toggle:scale-75 group-hover/sidebar-toggle:opacity-0" />
                <PanelLeftOpen className="absolute h-7 w-7 scale-75 opacity-0 transition-all duration-150 group-hover/sidebar-toggle:scale-100 group-hover/sidebar-toggle:opacity-100 text-brand-green" />
              </div>
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1713] bg-brand-cyan transition-opacity group-hover/sidebar-toggle:opacity-0" />
              <SidebarTooltip id="sidebar-open-tooltip" label="Open sidebar" placement="side" />
            </button>
          </div>

          {/* 2. DOCK for Navigation Tabs & Bottom Actions */}
          <Dock
            direction="vertical"
            distance={85}
            baseSize={40}
            magnification={48}
            spring={{ mass: 0.08, stiffness: 320, damping: 16 }}
            className="flex h-full w-full flex-col items-center justify-start mt-6"
            ariaLabel={`${user.role.toLowerCase()} navigation`}
          >
            {/* Center Navigation Tabs */}
            <nav
              id="nutrimind-sidebar-navigation"
              className="flex shrink-0 flex-col items-center gap-3 py-1"
              aria-label={`${user.role.toLowerCase()} tabs`}
            >
              {navItems.map((item) => {
                const isSelected =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`) ||
                  (item.href === '/nutritionist/reviews' &&
                    ['/nutritionist/outside-meals', '/nutritionist/approved'].includes(pathname));
                const isPending = pendingHref === item.href;
                const active = isPending || (isSelected && !pendingHref);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    onMouseEnter={() => router.prefetch(item.href)}
                    onTouchStart={() => router.prefetch(item.href)}
                    onClick={() => {
                      if (item.href !== pathname) setPendingHref(item.href);
                    }}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className="flex shrink-0 items-center justify-center outline-none"
                  >
                    <DockItem
                      active={active}
                      className={`transition-colors duration-200 ${
                        active
                          ? 'bg-[#eb6a38] text-white font-bold shadow-sm'
                          : 'text-white/60 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      <DockLabel>{item.label}</DockLabel>
                      <DockIcon>
                        <Icon className={active ? 'stroke-[2.5]' : 'stroke-2'} />
                      </DockIcon>
                    </DockItem>
                  </Link>
                );
              })}
            </nav>

            {/* 3. BOTTOM GROUP: Secondary actions (Logout) & Profile Avatar */}
            <div className="mt-auto flex shrink-0 flex-col items-center gap-2 pb-0.5">
              <div className="h-px w-6 bg-white/[0.08] mb-0.5" />

              <a
                href="/docs"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Docs & Help"
                className="flex shrink-0 items-center justify-center outline-none"
              >
                <DockItem className="text-white/60 hover:bg-white/[0.08] hover:text-white transition-colors duration-200">
                  <DockLabel>Docs & Help</DockLabel>
                  <DockIcon>
                    <BookOpen className="stroke-2" />
                  </DockIcon>
                </DockItem>
              </a>

              <div className="relative" ref={collapsedMenuRef}>
                <button
                  type="button"
                  role="link"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  aria-label={`Profile: ${user.name}`}
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  aria-current={profileActive ? 'page' : undefined}
                  className="flex shrink-0 items-center justify-center outline-none"
                >
                  <DockItem
                    active={profileActive || isProfileMenuOpen}
                    className={`rounded-full transition-[box-shadow] duration-150 ${
                      isPro
                        ? `relative overflow-hidden p-[2.5px] ${
                            profileActive || isProfileMenuOpen
                              ? 'shadow-[0_0_14px_rgba(235,106,56,0.6)]'
                              : 'hover:shadow-[0_0_10px_rgba(235,106,56,0.4)]'
                          }`
                        : `p-0.5 ${
                            profileActive || isProfileMenuOpen
                              ? 'ring-2 ring-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                              : 'hover:ring-2 hover:ring-[#3b82f6]/50'
                          }`
                    }`}
                  >
                    {isPro && (
                      <span
                        className="pointer-events-none absolute inset-[-150%] animate-[spin_4s_linear_infinite]"
                        style={{
                          background:
                            'conic-gradient(from 0deg, #eb6a38 0deg, #f09e6c 90deg, #10b981 180deg, #34d399 270deg, #eb6a38 360deg)',
                        }}
                        aria-hidden="true"
                      />
                    )}
                    <DockLabel>Profile · {user.name}{isPro ? ' (Pro)' : ''}</DockLabel>
                    <DockAvatar>
                      <Avatar
                        size="sm"
                        src={user.image}
                        fallbackText={user.name}
                        className="relative z-10 !h-full !w-full rounded-full ring-1 ring-black/20"
                      />
                    </DockAvatar>
                  </DockItem>
                </button>
                {isProfileMenuOpen && (
                  <div className="absolute bottom-0 left-full ml-3 z-50">
                    <ProfileWidget onClose={() => setIsProfileMenuOpen(false)} />
                  </div>
                )}
              </div>
            </div>
          </Dock>
        </div>
      ) : (
        <>
          {/* Expanded Header */}
          <div className="relative flex items-center justify-between gap-3 px-1 pb-5">
            <Link
              href={homeHref}
              prefetch={true}
              onMouseEnter={() => router.prefetch(homeHref)}
              onTouchStart={() => router.prefetch(homeHref)}
              className="group/logo flex min-w-0 items-center gap-3 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-brand-accent/40"
              aria-label="KAINARA home"
            >
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center transition-transform duration-200 group-hover/logo:scale-105">
                <span className="flex h-full w-full items-center justify-center rounded-full overflow-hidden">
                  <KainaraLogo className="h-11 w-11" />
                </span>
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0d1713] bg-brand-cyan" />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[16px] font-extrabold tracking-[0.16em]">KAINARA</span>
                <span className="mt-1 block truncate font-mono text-[9px] uppercase tracking-[0.15em] text-white/40">
                  {roleLabel}
                </span>
              </span>
            </Link>

            <div className="group relative ml-auto shrink-0">
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label="Close sidebar"
                aria-describedby="sidebar-close-tooltip"
                aria-controls="nutrimind-sidebar-navigation"
                aria-expanded={true}
                className="flex h-10 w-10 cursor-ew-resize items-center justify-center rounded-xl border border-[#173e33] bg-[#0e271f] text-emerald-400/80 outline-none transition hover:border-[#f09e6c]/40 hover:bg-[#163930] hover:text-white focus-visible:ring-2 focus-visible:ring-brand-cyan/70"
              >
                <PanelLeftClose className="h-[18px] w-[18px]" />
              </button>
              <SidebarTooltip id="sidebar-close-tooltip" label="Close sidebar" placement="below" />
            </div>
          </div>

          <div className="mb-3 flex items-center justify-between px-3">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-white/30">Navigation</span>
            <Activity className="h-3.5 w-3.5 text-brand-cyan/60" />
          </div>

          <nav
            id="nutrimind-sidebar-navigation"
            className="relative flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden scrollbar-thin [scrollbar-color:rgba(255,255,255,0.15)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/30 [&::-webkit-scrollbar-track]:bg-transparent"
            aria-label={`${user.role.toLowerCase()} navigation`}
          >
            {navItems.map((item, index) => {
              const isSelected =
                pathname === item.href ||
                pathname.startsWith(`${item.href}/`) ||
                (item.href === '/nutritionist/reviews' &&
                  ['/nutritionist/outside-meals', '/nutritionist/approved'].includes(pathname));
              const isPending = pendingHref === item.href;
              const active = isPending || (isSelected && !pendingHref);
              const Icon = item.icon;
              return (
                <React.Fragment key={item.href}>
                  {user.role === 'ADMIN' && (index === 0 || navItems[index - 1].group !== item.group) && (
                    <p className="px-3 pt-3 pb-1 text-xs font-semibold text-white/60">{item.group}</p>
                  )}
                  <Link
                    href={item.href}
                    prefetch={true}
                    onMouseEnter={() => router.prefetch(item.href)}
                    onTouchStart={() => router.prefetch(item.href)}
                    onClick={() => {
                      if (item.href !== pathname) setPendingHref(item.href);
                    }}
                    aria-label={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`group relative flex min-h-12 items-center gap-3 rounded-2xl px-3.5 outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-[#071914] ${
                      active ? 'text-white' : 'text-white/55 hover:bg-white/[0.055] hover:text-white'
                    }`}
                  >
                    {active && (
                      <MotionActiveIndicator
                        layoutId="sidebar-active-nav-indicator"
                        className="rounded-2xl bg-[#eb6a38] shadow-sm"
                      />
                    )}
                    <span className="relative z-10 flex w-full items-center gap-3">
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'stroke-[2.5]' : ''}`} />
                      <span className="font-display text-[13px] font-semibold tracking-tight">{item.label}</span>
                      {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/70" />}
                    </span>
                  </Link>
                </React.Fragment>
              );
            })}
          </nav>

          <div className="relative mt-auto flex flex-col gap-1 border-t border-[#173e33] pt-3">
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Docs & Help"
              className="group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/60 outline-none transition hover:bg-white/[0.06] hover:text-white focus:ring-2 focus:ring-brand-accent/30"
            >
              <BookOpen className="h-4 w-4 shrink-0 stroke-2 text-white/60 transition-colors group-hover:text-brand-accent" />
              <span className="text-xs font-semibold text-white/75 transition-colors group-hover:text-white">
                Docs & Help
              </span>
              <ArrowUpRight className="ml-auto h-3.5 w-3.5 text-white/30 transition-colors group-hover:text-white/70" />
            </a>

            <div className="relative" ref={profileMenuRef}>
              {isProfileMenuOpen && (
                <div className="absolute bottom-full left-0 mb-2 z-50 w-full min-w-[270px]">
                  <ProfileWidget onClose={() => setIsProfileMenuOpen(false)} />
                </div>
              )}
              <button
                type="button"
                role="link"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                aria-label={`Profile: ${user.name}`}
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
                aria-current={profileActive ? 'page' : undefined}
                className="group relative flex w-full items-center gap-3 rounded-2xl p-2 text-left outline-none transition hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-brand-cyan/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07100d]"
              >
                {isPro ? (
                  <div
                    className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full p-[2px] transition-[box-shadow] duration-150 ${
                      profileActive || isProfileMenuOpen
                        ? 'shadow-[0_0_12px_rgba(235,106,56,0.55)]'
                        : 'group-hover:shadow-[0_0_8px_rgba(235,106,56,0.35)]'
                    }`}
                  >
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
                      className="relative z-10 !h-full !w-full rounded-full ring-1 ring-black/20"
                    />
                  </div>
                ) : (
                  <Avatar
                    size="sm"
                    src={user.image}
                    fallbackText={user.name}
                    className={`h-9 w-9 rounded-full ring-2 transition-[box-shadow,color] duration-150 ${
                      profileActive || isProfileMenuOpen
                        ? 'ring-[#3b82f6] shadow-[0_0_10px_rgba(59,130,246,0.4)]'
                        : 'ring-transparent group-hover:ring-[#3b82f6]/50'
                    }`}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-semibold text-white/90">{user.name}</p>
                    {isPro && (
                      <span className="rounded bg-[#082e25] border border-[#10b981]/40 px-1 py-0 text-[8px] font-mono font-bold text-[#f09e6c]">
                        PRO
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate font-mono text-[9px] uppercase tracking-wider text-white/35">
                    {user.role}
                  </p>
                </div>
                <ChevronUp
                  className={`h-4 w-4 text-white/40 transition-transform duration-150 ${
                    isProfileMenuOpen ? 'rotate-180 text-white/80' : 'group-hover:text-white/60'
                  }`}
                />
              </button>
            </div>
          </div>
        </>
      )}
    </aside>
  );
};

export default Sidebar;

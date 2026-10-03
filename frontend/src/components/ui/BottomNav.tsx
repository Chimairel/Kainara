'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Activity, Home, Soup, ShoppingCart, User } from 'lucide-react';
import ProfileWidget from '@/components/ui/ProfileWidget';

export const BottomNav: React.FC<{ className?: string }> = ({ className = '' }) => {
  const pathname = usePathname();
  const { user } = useAuth();
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  useEffect(() => {
    setPendingHref(null);
    setIsProfileMenuOpen(false);
  }, [pathname]);
  if (!user || user.role !== 'USER') return null;
  const items = [
    { label: 'Home', href: '/dashboard', icon: Home },
    { label: 'Meals', href: '/meals', icon: Soup },
    { label: 'Groceries', href: '/grocery', icon: ShoppingCart },
    { label: 'Progress', href: '/progress', icon: Activity },
    { label: 'Profile', href: '/profile', icon: User },
  ];
  return (
    <>
      {isProfileMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close profile menu"
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={() => setIsProfileMenuOpen(false)}
          />
          <div
            className="fixed right-3 z-50 w-72 max-w-[calc(100vw-24px)] md:hidden"
            style={{ bottom: 'calc(92px + env(safe-area-inset-bottom))' }}
          >
            <ProfileWidget onClose={() => setIsProfileMenuOpen(false)} />
          </div>
        </>
      )}
      <nav
        aria-label="Mobile navigation"
        className={`fixed inset-x-3 z-50 mx-auto grid max-w-md grid-cols-5 gap-1 rounded-2xl border border-brand-border bg-brand-surface/95 p-2 shadow-xl backdrop-blur-xl md:hidden ${className}`}
        style={{ bottom: 'calc(12px + env(safe-area-inset-bottom))' }}
      >
        {items.map((item) => {
          const active = (pendingHref ?? pathname) === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const classes = `flex min-h-[52px] min-w-[44px] touch-manipulation flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-green ${active || (item.label === 'Profile' && isProfileMenuOpen) ? 'bg-brand-accent text-white' : 'text-brand-muted'}`;
          const content = (
            <>
              <Icon className="pointer-events-none h-5 w-5" />
              <span className="pointer-events-none">{item.label}</span>
            </>
          );
          return item.label === 'Profile' ? (
            <button
              key={item.href}
              type="button"
              aria-label="Profile"
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
              className={classes}
              onClick={() => setIsProfileMenuOpen((value) => !value)}
            >
              {content}
            </button>
          ) : (
            <Link
              key={item.href}
              href={item.href}
              prefetch
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={classes}
              onClick={() => {
                setIsProfileMenuOpen(false);
                if (pathname !== item.href) setPendingHref(item.href);
              }}
            >
              {content}
            </Link>
          );
        })}
      </nav>
    </>
  );
};
export default BottomNav;

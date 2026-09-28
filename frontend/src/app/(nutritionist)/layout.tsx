'use client';

import React from 'react';
import { ClipboardList, Utensils, User } from 'lucide-react';
import PortalRoleLayout from '@/components/shared/PortalRoleLayout';

const navItems = [
  { href: '/nutritionist/reviews', label: 'Reviews', icon: ClipboardList },
  { href: '/nutritionist/library', label: 'Library', icon: Utensils },
  { href: '/nutritionist/profile', label: 'Profile', icon: User },
];

export default function NutritionistLayout({ children }: { children: React.ReactNode }) {
  return <>
    <div className="flex min-h-screen items-center justify-center bg-brand-bg p-6 text-center text-brand-text lg:hidden" role="status">
      <div className="max-w-md rounded-2xl border border-brand-border bg-brand-surface p-6">
        <h1 className="font-display text-xl font-bold">Open the nutritionist workspace on a desktop</h1>
        <p className="mt-3 text-sm text-brand-muted">Reviewing patient cases and documents requires a screen at least 1024 pixels wide. Your work remains available when you return on a desktop.</p>
      </div>
    </div>
    <div className="hidden lg:block"><PortalRoleLayout navItems={navItems}>{children}</PortalRoleLayout></div>
  </>;
}

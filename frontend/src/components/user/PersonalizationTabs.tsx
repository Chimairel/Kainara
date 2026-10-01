'use client';

import React from 'react';
import Link from 'next/link';
import { HeartPulse, Soup, ClipboardList } from 'lucide-react';

interface PersonalizationTabsProps {
  activeTab: 'health' | 'planning' | 'clinical-evidence';
}

export default function PersonalizationTabs({ activeTab }: PersonalizationTabsProps) {
  const tabs = [
    {
      id: 'health',
      label: 'Health & goals',
      shortLabel: 'Health',
      href: '/profile/health',
      icon: HeartPulse,
    },
    {
      id: 'planning',
      label: 'Food & planning',
      shortLabel: 'Planning',
      href: '/profile/planning',
      icon: Soup,
    },
    {
      id: 'clinical-evidence',
      label: 'Clinical documents',
      shortLabel: 'Documents',
      href: '/profile/clinical-evidence',
      icon: ClipboardList,
    },
  ] as const;

  return (
    <nav
      className="mb-6 grid grid-cols-3 gap-1 rounded-[22px] border border-brand-border/70 bg-brand-surface/85 p-1.5 shadow-sm"
      aria-label="Personalization sections"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-11 items-center justify-center gap-2 rounded-2xl px-3 text-xs font-bold outline-none transition focus-visible:ring-2 focus-visible:ring-brand-green/30 ${
              isActive
                ? 'bg-brand-accent text-white shadow-neon'
                : 'text-brand-muted hover:bg-brand-bgAlt hover:text-brand-text'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}

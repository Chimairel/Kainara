'use client';

import React from 'react';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
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
      label: 'Health details',
      shortLabel: 'Details',
      href: '/profile/clinical-evidence',
      icon: ClipboardList,
    },
  ] as const;

  return (
    <WorkspaceTabs
      value={activeTab}
      label="Personalization sections"
      className="mb-6"
      items={tabs.map((tab) => ({
        value: tab.id,
        href: tab.href,
        icon: <tab.icon className="h-4 w-4 shrink-0" />,
        label: (
          <>
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.shortLabel}</span>
          </>
        ),
      }))}
    />
  );
}

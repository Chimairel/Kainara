'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { AppIcon } from '@/components/ui/icons';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { HeaderRefreshTarget } from '@/components/shared/HeaderRefreshAction';
import { useBreadcrumb } from '@/lib/context/BreadcrumbContext';
import { useAuth } from '@/hooks/useAuth';

export interface AdminWorkspaceTab {
  id: string;
  label: string;
  icon?: AppIcon;
  render: (active: boolean) => ReactNode;
}

export default function AdminTabbedWorkspace({
  title,
  description,
  tabs,
  tabAliases = {},
}: {
  title: string;
  description: string;
  tabs: AdminWorkspaceTab[];
  tabAliases?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const requested = params.get('tab') ?? '';
  const selected = tabs.find((tab) => tab.id === (tabAliases[requested] ?? requested)) ?? tabs[0];
  const ownerId = useAuth().user?.userId;
  const { setSubTab } = useBreadcrumb();
  const [visited, setVisited] = useState(() => new Set([selected.id]));
  const [refreshTarget, setRefreshTarget] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setVisited((previous) => new Set([...previous, selected.id]));
    setSubTab(selected.label);
    return () => setSubTab(null);
  }, [selected.id, selected.label, setSubTab]);

  return (
    <HeaderRefreshTarget.Provider value={refreshTarget}>
      <div className="portal-page space-y-6">
        <PortalPageHeader
          title={title}
          description={description}
          titleActions={<div ref={setRefreshTarget} className="flex shrink-0" />}
        />
        <Tabs
          value={selected.id}
          activationMode="manual"
          onValueChange={(id) => {
            const next = new URLSearchParams(params.toString());
            next.set('tab', id);
            router.replace(`${pathname}?${next.toString()}`, { scroll: false });
          }}
        >
          <TabsList aria-label={`${title} sections`} className="overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger key={tab.id} value={tab.id} className="min-h-11 flex-1 gap-2">
                  {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />}
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {/* Retain visited forms. Inactive panels disable polling through their active prop. */}
          {tabs
            .filter((tab) => visited.has(tab.id) || selected.id === tab.id)
            .map((tab) => (
              <TabsContent
                key={`${ownerId}:${tab.id}`}
                value={tab.id}
                forceMount
                hidden={tab.id !== selected.id}
                style={tab.id !== selected.id ? { display: 'none' } : undefined}
              >
                {tab.render(tab.id === selected.id)}
              </TabsContent>
            ))}
        </Tabs>
      </div>
    </HeaderRefreshTarget.Provider>
  );
}

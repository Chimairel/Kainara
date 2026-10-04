'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { useBreadcrumb } from '@/lib/context/BreadcrumbContext';
import { useAuth } from '@/hooks/useAuth';

export interface AdminWorkspaceTab {
  id: string;
  label: string;
  render: (active: boolean) => ReactNode;
}

export default function AdminTabbedWorkspace({
  title,
  description,
  tabs,
}: {
  title: string;
  description: string;
  tabs: AdminWorkspaceTab[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = tabs.find((tab) => tab.id === params.get('tab')) ?? tabs[0];
  const ownerId = useAuth().user?.userId;
  const { setSubTab } = useBreadcrumb();
  const [visited, setVisited] = useState(() => new Set([selected.id]));
  useEffect(() => {
    setVisited((previous) => new Set([...previous, selected.id]));
    setSubTab(selected.label);
    return () => setSubTab(null);
  }, [selected.id, selected.label, setSubTab]);

  return (
    <div className="portal-page space-y-6">
      <PortalPageHeader title={title} description={description} />
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
          {tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id} className="min-h-11 flex-1">
              {tab.label}
            </TabsTrigger>
          ))}
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
  );
}

'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { useState } from 'react';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import { BookOpen, DatabaseZap, LayoutDashboard, ShieldCheck, Waypoints } from '@/components/ui/icons';
import HeaderRefreshAction from '@/components/shared/HeaderRefreshAction';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import DataForms from '@/features/admin-data/DataForms';
import NutritionRuleWorkspace from '@/features/admin-data/NutritionRuleWorkspace';
import DataWorkspaceOverview from '@/features/admin-data/DataWorkspaceOverview';
import FoodCatalogue from '@/features/admin-data/FoodCatalogue';
import type { AdminDataSection, ApiEnvelope, DataWorkspace } from '@/features/admin-data/types';
import { useAuth } from '@/hooks/useAuth';

export default function AdminDataPage() {
  const ownerId = useAuth().user?.userId;
  const query = useSessionQuery<DataWorkspace>({
    ownerId,
    resource: 'admin-data-workspace-v3',
    pollIntervalMs: false,
    errorMessage: 'Could not load the data administration workspace.',
    fetcher: async () => (await api.get<ApiEnvelope<DataWorkspace>>('/admin/data')).data.data,
  });
  const workspace = query.data;
  const loading = query.isLoading;
  const [section, setSection] = useState<AdminDataSection>('overview');
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const load = async () => {
    await query.refetch();
  };

  async function changed(message: string) {
    setNotice({ tone: 'success', message });
    await load();
  }

  function failed(message: string) {
    setNotice({ tone: 'error', message });
  }

  if (loading && !workspace) return <PortalLoadingState fillContainer message="Loading governed nutrition data..." />;
  if (!workspace) {
    return (
      <div className="portal-page">
        <p className="rounded-2xl bg-red-500/10 p-5 text-sm text-status-error-text">
          {query.error || notice?.message || 'Data workspace unavailable.'}
        </p>
        <Button className="mt-4" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={DatabaseZap}
        eyebrow="Data governance"
        title="Nutrition data center"
        description="Inspect FNRI and USDA nutrient records, maintain verified aliases, and review recorded source evidence."
        titleActions={<HeaderRefreshAction label="Refresh nutrition data" onRefresh={load} busy={loading} />}
        meta={
          <div className="flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-2 text-brand-green">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em]">Admin governed · audited</span>
          </div>
        }
      />

      {query.error && <FeedbackNotice variant="inline">{query.error}</FeedbackNotice>}

      {notice && (
        <FeedbackNotice tone={notice.tone}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{notice.message}</span>
            <button type="button" className="text-xs opacity-70 hover:opacity-100" onClick={() => setNotice(null)}>
              Dismiss
            </button>
          </div>
        </FeedbackNotice>
      )}

      <Tabs value={section} onValueChange={(value) => setSection(value as AdminDataSection)}>
        <TabsList
          aria-label="Nutrition data workspace"
          className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <TabsTrigger value="overview" className="min-w-fit flex-1 gap-2">
            <LayoutDashboard className="h-4 w-4" /> Overview
          </TabsTrigger>
          <TabsTrigger value="sources" className="min-w-fit flex-1 gap-2">
            <Waypoints className="h-4 w-4" /> Sources & releases
          </TabsTrigger>
          <TabsTrigger value="catalogue" className="min-w-fit flex-1 gap-2">
            <BookOpen className="h-4 w-4" /> FNRI catalogue
          </TabsTrigger>
          <TabsTrigger value="usda-catalogue" className="min-w-fit flex-1 gap-2">
            <BookOpen className="h-4 w-4" /> USDA catalogue
          </TabsTrigger>
          <TabsTrigger value="rules" className="min-w-fit flex-1">Screening rules</TabsTrigger>
        </TabsList>
        <TabsContent value="rules"><NutritionRuleWorkspace role="admin" /></TabsContent>

        <TabsContent value="overview">
          <DataWorkspaceOverview
            summary={workspace.summary}
            releaseCount={workspace.releases.length}
            releases={workspace.releases}
            onNavigate={setSection}
          />
        </TabsContent>
        <TabsContent value="sources">
          <DataForms sources={workspace.sources} onChanged={changed} onError={failed} />
        </TabsContent>
        <TabsContent value="catalogue">
          <FoodCatalogue source="FNRI" onChanged={changed} onError={failed} />
        </TabsContent>
        <TabsContent value="usda-catalogue">
          <FoodCatalogue source="USDA_FDC" onChanged={changed} onError={failed} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

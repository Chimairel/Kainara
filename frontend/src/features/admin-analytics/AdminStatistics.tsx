'use client';

import { ShieldCheck, Cpu, RefreshCw, BarChart3 } from 'lucide-react';

import Button from '@/components/ui/Button';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';

import { AnalyticsTab } from '@/features/admin-analytics/sections/AdminStatistics.shared';
export type { AnalyticsTab } from '@/features/admin-analytics/sections/AdminStatistics.shared';
import { useAdminStatisticsModel } from '@/features/admin-analytics/sections/useAdminStatisticsModel';
import PlatformTotalsSection from '@/features/admin-analytics/sections/PlatformTotalsSection';
import ReviewEvidenceSection from '@/features/admin-analytics/sections/ReviewEvidenceSection';
import RecordedAiActivitySection from '@/features/admin-analytics/sections/RecordedAiActivitySection';
export default function AdminStatistics({
  active = true,
  defaultTab = 'totals',
  tab,
  onTabChange,
}: {
  active?: boolean;
  defaultTab?: AnalyticsTab;
  tab?: AnalyticsTab;
  onTabChange?: (tab: AnalyticsTab) => void;
}) {
  const model = useAdminStatisticsModel({ active, defaultTab, tab, onTabChange });
  if (model.kind === 'early') return model.view;
  const { data, refetch, error, activeTab, handleTabChange } = model;
  return (
    <div className="space-y-8">
      {/* Top Snapshot Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-border/60 bg-brand-surface/60 px-4 py-3 backdrop-blur-xs">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <p className="text-xs font-medium text-brand-muted">
            Snapshot: {new Date(data.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila)
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh statistics
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-status-warning-text/30 p-3 text-sm text-status-warning-text"
        >
          {error} Showing the last successful snapshot above.
        </p>
      )}

      {/* Analytics View Section Tabs */}
      <WorkspaceTabs
        value={activeTab}
        onChange={handleTabChange}
        label="Analytics view sections"
        items={[
          {
            value: 'totals',
            label: 'Platform Totals',
            icon: <BarChart3 className="h-4 w-4 shrink-0" aria-hidden="true" />,
          },
          {
            value: 'review-signals',
            label: 'Review & preparation signals',
            icon: <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />,
          },
          {
            value: 'ai-activity',
            label: 'Recorded AI activity',
            icon: <Cpu className="h-4 w-4 shrink-0" aria-hidden="true" />,
          },
        ]}
      />

      {/* 1. Platform Totals Tab */}
      <PlatformTotalsSection model={model} />

      {/* 2. Review & Preparation Signals + Recorded Library Evidence Tab */}
      <ReviewEvidenceSection model={model} />

      {/* 3. Recorded AI Activity Tab */}
      <RecordedAiActivitySection model={model} />
    </div>
  );
}

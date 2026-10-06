'use client';
import { useState, useEffect } from 'react';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

import { useAdminAnalytics } from '../useAdminAnalytics';
import { AnalyticsTab } from './AdminStatistics.shared';
export function useAdminStatisticsModel({
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
  const [internalTab, setInternalTab] = useState<AnalyticsTab>(defaultTab);
  const activeTab = tab ?? internalTab;
  const handleTabChange = onTabChange ?? setInternalTab;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash;
    if (hash === '#review-signals' || hash === '#library-evidence') {
      handleTabChange('review-signals');
    } else if (hash === '#ai-history' || hash === '#ai-activity') {
      handleTabChange('ai-activity');
    }
  }, [handleTabChange]);

  const { data, error, isLoading, refetch } = useAdminAnalytics(active);
  if (!data)
    return {
      kind: 'early' as const,
      view: (
        <Card className="space-y-3 p-6">
          <p role={error ? 'alert' : 'status'}>
            {error ?? (isLoading ? 'Loading platform statistics…' : 'Statistics are unavailable.')}
          </p>
          {error && (
            <Button variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          )}
        </Card>
      ),
    };

  const savedCandidates = data.planSelectionsByProvenance30d.reduce((sum, row) => sum + row.count, 0);
  const totalEvidence = data.completeLibraryEvidence + data.incompleteLibraryEvidence + data.staleLibraryEvidence;
  const completePercent = totalEvidence > 0 ? Math.round((data.completeLibraryEvidence / totalEvidence) * 100) : 0;
  const incompletePercent = totalEvidence > 0 ? Math.round((data.incompleteLibraryEvidence / totalEvidence) * 100) : 0;
  const stalePercent = totalEvidence > 0 ? Math.max(0, 100 - completePercent - incompletePercent) : 0;

  const total24hAi = data.aiSuccess24h + data.aiFailures24h;
  const aiSuccessRate = total24hAi > 0 ? ((data.aiSuccess24h / total24hAi) * 100).toFixed(1) : '100.0';

  return {
    kind: 'ready' as const,
    data,
    refetch,
    error,
    activeTab,
    handleTabChange,
    completePercent,
    incompletePercent,
    stalePercent,
    aiSuccessRate,
    savedCandidates,
  };
}

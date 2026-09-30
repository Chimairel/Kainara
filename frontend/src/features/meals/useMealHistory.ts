import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import { formatManilaDate, getManilaDateKey, manilaDateFromKey } from '@/lib/manila-date';
import { summarizeMealIntake } from '@/lib/meal-history-summary';
import { useEffect, useState } from 'react';
import type { MealHistoryLog } from './meals-workspace.types';

export function useMealHistory(ownerId: string | undefined, enabled: boolean, fetchMeals: () => Promise<void>) {
  const [historySearch, setHistorySearch] = useState('');
  const [historySource, setHistorySource] = useState('All');
  const [historyStatus, setHistoryStatus] = useState('All');
  const [historyCount, setHistoryCount] = useState<{ ownerId: string | undefined; count: number } | null>(null);
  const historyTotalCount = historyCount?.ownerId === ownerId ? (historyCount?.count ?? null) : null;
  const query = useSessionQuery<MealHistoryLog[]>({
    ownerId,
    enabled,
    resource: `user-meals-history:${historySearch}:${historySource}:${historyStatus}`,
    errorMessage: 'Failed to fetch meal history.',
    fetcher: async () => {
      const params: Record<string, string> = {};
      if (historySearch) params.search = historySearch;
      if (historySource !== 'All') params.source = historySource;
      if (historyStatus !== 'All') params.status = historyStatus;
      const response = await api.get('/user/meals/history', { params });
      if (!response.data?.success) throw new Error('Failed to fetch meal history.');
      return response.data.data;
    },
  });
  const historyLogs = query.data ?? [];
  const fetchHistory = query.refetch;
  useEffect(() => {
    if (query.data && !historySearch && historySource === 'All' && historyStatus === 'All')
      setHistoryCount({ ownerId, count: query.data.length });
  }, [ownerId, query.data, historySearch, historySource, historyStatus]);

  const handleUpdateLogNotes = async (logId: string, notes: string | null) => {
    const response = await api.patch(`/user/meals/logs/${logId}/notes`, { notes });
    if (response.data?.success)
      query.setData(historyLogs.map((log) => (log.id === logId ? { ...log, notes: response.data.data.notes } : log)));
  };

  const handleEditOutsideItem = async (
    logId: string,
    itemId: string,
    input: {
      name: string;
      portionGrams: number | null;
      reportedNutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number };
      unresolved?: boolean;
      reason: string;
    }
  ) => {
    await api.patch(`/user/meals/logs/${logId}/items/${itemId}`, input);
    await Promise.all([fetchHistory(), fetchMeals()]);
  };

  const handleVoidOutsideLog = async (logId: string, reason: string) => {
    await api.post(`/user/meals/logs/${logId}/void`, { reason });
    await Promise.all([fetchHistory(), fetchMeals()]);
  };

  const handleRequestOutsideReview = async (logId: string, itemId: string) => {
    await api.post(`/user/meals/logs/${logId}/items/${itemId}/request-review`);
    await fetchHistory();
  };

  const handleReplyToOutsideReview = async (logId: string, itemId: string, message: string) => {
    await api.post(`/user/meals/logs/${logId}/items/${itemId}/reply`, { message });
    await fetchHistory();
  };

  const handleObservedConsent = async (logId: string, itemId: string, imageReuseConsent: boolean) => {
    await api.post(`/user/meals/logs/${logId}/items/${itemId}/observed-consent`, {
      detailsConsent: true,
      imageReuseConsent,
      imageRightsConfirmed: imageReuseConsent,
    });
    await fetchHistory();
  };

  const handleObservedWithdraw = async (submissionId: string) => {
    await api.post(`/user/meals/observed-submissions/${submissionId}/withdraw`);
    await fetchHistory();
  };

  const groupHistoryByDate = () => {
    const grouped: Record<string, MealHistoryLog[]> = {};
    historyLogs.forEach((log) => {
      const dateKey = getManilaDateKey(log.loggedAt);
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(log);
    });

    return Object.keys(grouped)
      .sort((a, b) => b.localeCompare(a))
      .map((dateKey) => {
        const logsList = grouped[dateKey];
        const parsedDate = manilaDateFromKey(dateKey);
        const weekday = formatManilaDate(parsedDate, { weekday: 'long' });
        const dateStr = formatManilaDate(parsedDate, { month: 'short', day: 'numeric', year: 'numeric' });
        const { totalCalories, totalProtein, totalCarbs, totalFat } = summarizeMealIntake(logsList);
        return {
          dateKey,
          weekday,
          dateStr,
          logsList,
          totalCalories,
          totalProtein,
          totalCarbs,
          totalFat,
          mealCount: logsList.length,
        };
      });
  };
  return {
    historyLogs,
    isHistoryLoading: query.isLoading,
    historyTotalCount,
    historyError: query.error,
    historySearch,
    setHistorySearch,
    historySource,
    setHistorySource,
    historyStatus,
    setHistoryStatus,
    fetchHistory,
    groupHistoryByDate,
    handleUpdateLogNotes,
    handleEditOutsideItem,
    handleVoidOutsideLog,
    handleRequestOutsideReview,
    handleReplyToOutsideReview,
    handleObservedConsent,
    handleObservedWithdraw,
  };
}

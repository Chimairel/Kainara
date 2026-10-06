'use client';

import { normalizeGroceryCategory as normalizeCategory } from '@/features/grocery/grocery-display';
import { useAuth } from '@/hooks/useAuth';
import { usePdfDownload } from '@/hooks/usePdfDownload';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import api from '@/lib/axios';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type GrocerySortField, type GrocerySortOrder } from '@/features/grocery/GroceryTable';
import {
  fetchGroceryWorkspace,
  isGroceryItemAvailable,
  type GroceryItem,
  type GroceryWorkspace,
} from '@/features/grocery/current-grocery';
import { getApiErrorMessage } from '@/lib/api-error';
import { readSessionResource, refreshSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

type GroceryFilter = 'all' | 'remaining' | 'available';
export function useGroceryWorkspace() {
  const { user } = useAuth();
  const ownerId = user?.userId;
  const cachedPage = readSessionResource<GroceryWorkspace>(ownerId, 'user-grocery-workspace');
  const [workspace, setWorkspace] = useState<GroceryWorkspace | null>(cachedPage ?? null);
  const [workspaceOwnerId, setWorkspaceOwnerId] = useState(ownerId);
  const workspaceRef = useRef<GroceryWorkspace | null>(cachedPage ?? null);
  const requestVersion = useRef(0);
  const ownerGeneration = useRef(0);
  const pendingRef = useRef(new Set<string>());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [scope, setScope] = useState<'CURRENT' | 'UPCOMING'>('CURRENT');
  const [isLoading, setIsLoading] = useState(!cachedPage);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<GroceryFilter>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [sortField, setSortField] = useState<GrocerySortField>('status');
  const [sortOrder, setSortOrder] = useState<GrocerySortOrder>('asc');
  const visibleWorkspace = workspaceOwnerId === ownerId ? workspace : null;
  const projection = scope === 'CURRENT' ? (visibleWorkspace?.current ?? null) : (visibleWorkspace?.upcoming ?? null);
  const groceryList = projection?.groceryList ?? null;
  const pendingMealCount = projection?.coverage.unresolvedSlotCount ?? 0;
  const canCheckItems = Boolean(projection?.actionability.canCheckItems);

  const cachePage = useCallback(
    (nextWorkspace: GroceryWorkspace) => {
      writeSessionResource(ownerId, 'user-grocery-workspace', nextWorkspace);
    },
    [ownerId]
  );

  const applyItems = useCallback(
    (items: GroceryItem[]) => {
      const current = workspaceRef.current;
      if (!current || items.length === 0) return;
      const byId = new Map(items.map((item) => [item.id, item]));
      const patch = (cycle: GroceryWorkspace['current']) =>
        cycle?.groceryList
          ? {
              ...cycle,
              groceryList: {
                ...cycle.groceryList,
                groceryItems: cycle.groceryList.groceryItems.map((item) => byId.get(item.id) ?? item),
              },
            }
          : cycle;
      const next = { current: patch(current.current), upcoming: patch(current.upcoming) };
      workspaceRef.current = next;
      setWorkspace(next);
      cachePage(next);
    },
    [cachePage]
  );

  const setPending = (ids: string[], pending: boolean) => {
    ids.forEach((id) => (pending ? pendingRef.current.add(id) : pendingRef.current.delete(id)));
    setPendingIds(new Set(pendingRef.current));
  };

  // Fetches current user grocery list
  const fetchGroceryList = useCallback(async () => {
    setError(null);
    const version = requestVersion.current;
    try {
      await refreshSessionResource(ownerId, 'user-grocery-workspace', fetchGroceryWorkspace);
      if (version === requestVersion.current) {
        const snapshot = readSessionResource<GroceryWorkspace>(ownerId, 'user-grocery-workspace');
        if (!snapshot) throw new Error('The grocery list changed while loading. Please retry loading.');
        workspaceRef.current = snapshot;
        setWorkspace(snapshot);
        cachePage(snapshot);
      }
    } catch (err: unknown) {
      if (version === requestVersion.current) setError(getApiErrorMessage(err, 'Failed to retrieve grocery list.'));
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }, [cachePage, ownerId]);

  useEffect(() => {
    ownerGeneration.current += 1;
    requestVersion.current += 1;
    pendingRef.current.clear();
    setPendingIds(new Set());
    setBulkBusy(false);
    setScope('CURRENT');
    setQuery('');
    setFilter('all');
    setSelectedCategory('ALL');
    const cached = readSessionResource<GroceryWorkspace>(ownerId, 'user-grocery-workspace');
    workspaceRef.current = cached;
    setWorkspaceOwnerId(ownerId);
    setWorkspace(cached);
    setIsLoading(Boolean(ownerId && !cached));
    if (ownerId) void fetchGroceryList();
  }, [ownerId, fetchGroceryList]);

  useVisiblePolling(
    async () => {
      await fetchGroceryList();
    },
    { enabled: Boolean(ownerId) && !bulkBusy && pendingIds.size === 0, immediate: false, scopeKey: ownerId }
  );

  const handleToggleItem = async (itemId: string) => {
    const item = groceryList?.groceryItems.find((row) => row.id === itemId);
    if (!canCheckItems || !item || pendingRef.current.has(itemId) || bulkBusy) return;
    setError(null);
    requestVersion.current += 1;
    const generation = ownerGeneration.current;
    setPending([itemId], true);
    const checked = !isGroceryItemAvailable(item);
    applyItems([
      { ...item, isChecked: checked, isPantryStaple: false, purchasedQuantity: checked ? (item.quantity ?? 0) : 0 },
    ]);
    try {
      const response = await api.patch('/user/grocery/items/' + itemId + '/toggle');
      if (!response.data?.success || !response.data.data) throw new Error('Checklist update was not confirmed.');
      if (generation === ownerGeneration.current) applyItems([response.data.data as GroceryItem]);
    } catch (err) {
      if (generation === ownerGeneration.current) {
        applyItems([item]);
        setError(getApiErrorMessage(err, 'Could not update the checklist. Refresh the list and try again.'));
      }
    } finally {
      if (generation === ownerGeneration.current) setPending([itemId], false);
    }
  };

  const { isDownloadingPdf, startPdfDownload } = usePdfDownload(ownerId);

  const handleDownloadPDF = async () => {
    if (!projection || !projection.actionability.canExportPdf || isDownloadingPdf) return;
    try {
      await startPdfDownload('/user/grocery/pdf', `KAINARA_Grocery_List_${groceryList?.weekLabel || 'Current'}.pdf`, {
        params: { cycleId: projection.cycle.id },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not download the grocery PDF. Please try again.');
    }
  };

  const handleAcknowledgeIncomplete = async () => {
    if (!projection) return;
    try {
      await api.post(`/user/meals/cycles/${projection.cycle.id}/acknowledge-incomplete`);
      await fetchGroceryList();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not acknowledge this partial grocery list.'));
    }
  };

  const totalItems = groceryList?.groceryItems.length || 0;
  const checkedItems = groceryList?.groceryItems.filter(isGroceryItemAvailable).length || 0;
  const remainingItems = totalItems - checkedItems;
  const normalizedQuery = query.trim().toLowerCase();

  const allCategories = useMemo(() => {
    if (!groceryList?.groceryItems) return [];
    const set = new Set<string>();
    groceryList.groceryItems.forEach((item) => {
      set.add(normalizeCategory(item.category));
    });
    return Array.from(set).sort();
  }, [groceryList]);

  const visibleItems = useMemo(() => {
    if (!groceryList?.groceryItems) return [];

    return groceryList.groceryItems
      .filter((item) => {
        const matchesQuery =
          !normalizedQuery ||
          item.ingredientName.toLowerCase().includes(normalizedQuery) ||
          normalizeCategory(item.category).toLowerCase().includes(normalizedQuery);

        const matchesStatus =
          filter === 'all' ||
          (filter === 'remaining' && !isGroceryItemAvailable(item)) ||
          (filter === 'available' && isGroceryItemAvailable(item));

        const matchesCategory = selectedCategory === 'ALL' || normalizeCategory(item.category) === selectedCategory;

        return matchesQuery && matchesStatus && matchesCategory;
      })
      .sort((a, b) => {
        let diff = 0;
        if (sortField === 'name') {
          diff = a.ingredientName.localeCompare(b.ingredientName);
        } else if (sortField === 'category') {
          diff = normalizeCategory(a.category).localeCompare(normalizeCategory(b.category));
        } else if (sortField === 'quantity') {
          diff = (a.quantity ?? 0) - (b.quantity ?? 0);
        } else if (sortField === 'status') {
          diff =
            Number(isGroceryItemAvailable(a)) - Number(isGroceryItemAvailable(b)) ||
            a.ingredientName.localeCompare(b.ingredientName);
        }

        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [groceryList, normalizedQuery, filter, selectedCategory, sortField, sortOrder]);

  const categoryCounts = useMemo(() => {
    if (!groceryList?.groceryItems) return {};
    const counts: Record<string, number> = {};
    groceryList.groceryItems.forEach((item) => {
      const cat = normalizeCategory(item.category);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [groceryList]);

  const isFiltered = query.trim() !== '' || filter !== 'all' || selectedCategory !== 'ALL';

  const handleResetFilters = () => {
    setQuery('');
    setFilter('all');
    setSelectedCategory('ALL');
  };

  const handleSort = (field: GrocerySortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const allVisibleChecked = visibleItems.length > 0 && visibleItems.every(isGroceryItemAvailable);

  const handleToggleAllVisible = async () => {
    if (!canCheckItems || visibleItems.length === 0 || pendingRef.current.size > 0 || bulkBusy) return;
    const targetState = !allVisibleChecked;
    const itemsToUpdate = visibleItems.filter((item) => isGroceryItemAvailable(item) !== targetState);
    if (itemsToUpdate.length === 0) return;
    setError(null);
    requestVersion.current += 1;
    const generation = ownerGeneration.current;
    setBulkBusy(true);
    const ids = itemsToUpdate.map((item) => item.id);
    setPending(ids, true);
    applyItems(
      itemsToUpdate.map((item) => ({
        ...item,
        isChecked: targetState,
        isPantryStaple: false,
        purchasedQuantity: targetState ? (item.quantity ?? 0) : 0,
      }))
    );
    try {
      const response = await api.patch('/user/grocery/items/checklist', { itemIds: ids, checked: targetState });
      if (!response.data?.success || !Array.isArray(response.data.data))
        throw new Error('Checklist update was not confirmed.');
      if (generation === ownerGeneration.current) applyItems(response.data.data as GroceryItem[]);
    } catch (err) {
      if (generation === ownerGeneration.current) {
        applyItems(itemsToUpdate);
        setError(getApiErrorMessage(err, 'Failed to update visible items.'));
      }
    } finally {
      if (generation === ownerGeneration.current) {
        setPending(ids, false);
        setBulkBusy(false);
      }
    }
  };

  const isReportPending = Boolean(
    (user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged) ||
    (error && error.toLowerCase().includes('nutrition report'))
  );

  return {
    isLoading,
    visibleWorkspace,
    scope,
    setScope,
    setQuery,
    setFilter,
    setSelectedCategory,
    error,
    isReportPending,
    projection,
    groceryList,
    pendingMealCount,
    handleAcknowledgeIncomplete,
    handleDownloadPDF,
    isDownloadingPdf,
    checkedItems,
    totalItems,
    remainingItems,
    canCheckItems,
    query,
    selectedCategory,
    allCategories,
    categoryCounts,
    filter,
    visibleItems,
    isFiltered,
    handleResetFilters,
    pendingIds,
    bulkBusy,
    handleToggleItem,
    sortField,
    sortOrder,
    handleSort,
    handleToggleAllVisible,
    allVisibleChecked,
  };
}

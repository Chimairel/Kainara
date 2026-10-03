import { useSessionQuery } from '@/hooks/useSessionQuery';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/lib/axios';
import { useRef, useState } from 'react';
import type { SwapOption } from './meals-workspace.types';

type LibrarySnapshot = { meals: SwapOption[]; total: number; nextCursor: string | null };

export function useMealLibrary(ownerId: string | undefined, enabled: boolean, date: string) {
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryMealType, setLibraryMealType] = useState('All');
  const [libraryRiceRole, setLibraryRiceRole] = useState('All');
  const resource = `user-meals-library-v3:${JSON.stringify([librarySearch, libraryMealType, libraryRiceRole, date])}`;
  const scope = JSON.stringify([ownerId, resource]);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const paginationRequest = useRef<{ scope: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState<string | null>(null);

  const fetchPage = async (cursor?: string): Promise<LibrarySnapshot> => {
    const params: Record<string, string> = { date, limit: '24' };
    if (libraryMealType !== 'All') params.mealType = libraryMealType;
    if (librarySearch) params.search = librarySearch;
    if (libraryRiceRole !== 'All') params.riceRole = libraryRiceRole;
    if (cursor) params.cursor = cursor;
    const response = await api.get('/user/meals/compatible-library', { params });
    if (!response.data?.success) throw new Error('Failed to load library meals.');
    const meals = Array.isArray(response.data.data) ? response.data.data : [];
    return {
      meals,
      total: Number(response.data.meta?.total ?? meals.length),
      nextCursor: response.data.meta?.nextCursor ?? null,
    };
  };
  const query = useSessionQuery<LibrarySnapshot>({
    ownerId,
    resource,
    enabled,
    fetcher: fetchPage,
    errorMessage: 'Failed to load library meals.',
  });
  const snapshot = useRef(query.data);
  snapshot.current = query.data;

  const fetchLibrary = async (cursor?: string) => {
    if (!cursor) return query.refetch();
    if (paginationRequest.current?.scope === scope) return;
    const request = { scope };
    paginationRequest.current = request;
    const currentScope = scope;
    setLoadingMore(currentScope);
    query.setError(null);
    try {
      const incoming = await fetchPage(cursor);
      if (activeScope.current !== currentScope) return;
      const current = snapshot.current?.meals ?? [];
      query.setData({
        ...incoming,
        meals: [...current, ...incoming.meals.filter((meal) => !current.some((entry) => entry.id === meal.id))],
      });
    } catch (error) {
      if (activeScope.current === currentScope)
        query.setError(getApiErrorMessage(error, 'Failed to load library meals.'));
    } finally {
      if (paginationRequest.current === request) paginationRequest.current = null;
      setLoadingMore((current) => (current === currentScope ? null : current));
    }
  };

  return {
    libraryMeals: query.data?.meals ?? [],
    isLibraryLoading: query.isLoading || loadingMore === scope,
    libraryTotalCount: query.data?.total ?? null,
    libraryError: query.error,
    librarySearch,
    setLibrarySearch,
    libraryMealType,
    setLibraryMealType,
    libraryRiceRole,
    setLibraryRiceRole,
    libraryNextCursor: query.data?.nextCursor ?? null,
    fetchLibrary,
  };
}

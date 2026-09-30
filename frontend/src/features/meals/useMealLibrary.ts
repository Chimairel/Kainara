import { useSessionQuery } from '@/hooks/useSessionQuery';
import { getApiErrorMessage } from '@/lib/api-error';
import api from '@/lib/axios';
import { useCallback, useRef, useState } from 'react';
import type { SwapOption } from './meals-workspace.types';

type LibrarySnapshot = { meals: SwapOption[]; total: number; nextCursor: string | null };

export function useMealLibrary(ownerId: string | undefined, enabled: boolean, date: string) {
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryMealType, setLibraryMealType] = useState('All');
  const [libraryFavoriteOnly, setLibraryFavoriteOnly] = useState(false);
  const [libraryRiceRole, setLibraryRiceRole] = useState('All');
  const resource = `user-meals-library-v2:${JSON.stringify([librarySearch, libraryMealType, libraryFavoriteOnly, libraryRiceRole, date])}`;
  const scope = JSON.stringify([ownerId, resource]);
  const activeScope = useRef(scope);
  activeScope.current = scope;
  const paginationRequest = useRef<{ scope: string } | null>(null);
  const [loadingMore, setLoadingMore] = useState<string | null>(null);

  const fetchPage = async (cursor?: string): Promise<LibrarySnapshot> => {
    const params: Record<string, string> = { date, limit: '24' };
    if (libraryMealType !== 'All') params.mealType = libraryMealType;
    if (librarySearch) params.search = librarySearch;
    if (libraryFavoriteOnly) params.favoriteOnly = 'true';
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
  const { setData } = query;
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

  const setLibraryMeals = useCallback(
    (update: (current: SwapOption[]) => SwapOption[]) => {
      if (activeScope.current !== scope) return;
      const current = snapshot.current;
      if (!current) return;
      const meals = update(current.meals);
      const next = { ...current, meals, total: Math.max(0, current.total + meals.length - current.meals.length) };
      snapshot.current = next;
      setData(next);
    },
    [setData, scope]
  );

  const toggleLibraryFavorite = async (meal: SwapOption) => {
    const currentScope = scope;
    const nextFavorite = !meal.isFavorite;
    if (nextFavorite) await api.post(`/user/meals/library/${meal.id}/favorite`);
    else await api.delete(`/user/meals/library/${meal.id}/favorite`);
    if (activeScope.current !== currentScope) return;
    setLibraryMeals((current) =>
      current
        .map((entry) => (entry.id === meal.id ? { ...entry, isFavorite: nextFavorite } : entry))
        .filter((entry) => !libraryFavoriteOnly || entry.isFavorite)
    );
  };

  return {
    libraryMeals: query.data?.meals ?? [],
    setLibraryMeals,
    isLibraryLoading: query.isLoading || loadingMore === scope,
    libraryTotalCount: query.data?.total ?? null,
    libraryError: query.error,
    librarySearch,
    setLibrarySearch,
    libraryMealType,
    setLibraryMealType,
    libraryFavoriteOnly,
    setLibraryFavoriteOnly,
    libraryRiceRole,
    setLibraryRiceRole,
    libraryNextCursor: query.data?.nextCursor ?? null,
    fetchLibrary,
    toggleLibraryFavorite,
  };
}

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';

export type CatalogRecipe = {
  id: string;
  name: string;
  description: string | null;
  mealTypes: string[];
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  sourceName: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  planningReady: boolean;
  inPlan?: boolean;
  occurrences?: Array<{ id: string; scheduledDate: string; cycleScope: string | null }>;
};
export type CatalogPage = {
  items: CatalogRecipe[];
  total: number;
  page: number;
  pageCount: number;
  restrictedProfile: boolean;
};

/** One reader for both catalogue surfaces. Scope changes never show another account/filter/page's response. */
export function useRecipeCatalog({
  search,
  mealType,
  riceRole = 'All',
  ownerId,
  enabled = true,
  page,
}: {
  search: string;
  mealType: string;
  riceRole?: string;
  ownerId?: string;
  enabled?: boolean;
  page: number;
}) {
  const scope = JSON.stringify([ownerId, search.trim(), mealType, riceRole, page]);
  const collection = JSON.stringify([ownerId, search.trim(), mealType, riceRole]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    scope: string;
    collection: string;
    data: CatalogPage | null;
    summary: Pick<CatalogPage, 'pageCount' | 'restrictedProfile'> | null;
    loading: boolean;
    error: string | null;
  } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const timer = setTimeout(() => {
      setState((previous) => ({
        scope,
        collection,
        data: null,
        summary: previous?.collection === collection ? previous.summary : null,
        loading: true,
        error: null,
      }));
      void api
        .get('/user/meals/verified-recipes', {
          params: {
            page,
            ...(search.trim() ? { search: search.trim() } : {}),
            ...(mealType !== 'All' ? { mealType } : {}),
            ...(riceRole !== 'All' ? { riceRole } : {}),
          },
        })
        .then((response) => {
          const data = response.data?.data as CatalogPage;
          if (!data || !Array.isArray(data.items) || !Number.isInteger(data.page) || !Number.isInteger(data.pageCount))
            throw new Error('Could not load recipes. Please try again.');
          if (active) setState({ scope, collection, data, summary: data, loading: false, error: null });
        })
        .catch((error) => {
          if (active)
            setState((previous) => ({
              scope,
              collection,
              data: null,
              summary: previous?.collection === collection ? previous.summary : null,
              loading: false,
              error: getApiErrorMessage(error, 'Could not load recipes.'),
            }));
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [scope, collection, search, mealType, riceRole, page, enabled, attempt]);
  const current = state?.scope === scope ? state : null;
  return {
    data: current?.data ?? null,
    summary: state?.collection === collection ? state.summary : null,
    loading: enabled && (current?.loading ?? true),
    error: current?.error ?? null,
    retry: () => setAttempt((value) => value + 1),
  };
}

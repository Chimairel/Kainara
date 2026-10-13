import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import type { MealPlan } from '@/types';
import { groupApprovedPlanRecipes } from './approvedPlanRecipes';

type LibraryCountSummary = { total: number; restrictedProfile: boolean; eligibleIds?: string[] };

/** The same catalogue/compatible recipe scope used by the Library panel, without loading cards. */
export function useMealLibraryCount({
  ownerId,
  enabled,
  search,
  mealType,
  riceRole,
  meals,
  revision,
}: {
  ownerId?: string;
  enabled: boolean;
  search: string;
  mealType: string;
  riceRole: string;
  meals: MealPlan[];
  revision?: number;
}) {
  const query = useSessionQuery<LibraryCountSummary>({
    ownerId,
    enabled,
    pollIntervalMs: false,
    resource: `user-meals-library-count:${JSON.stringify([search.trim(), mealType, riceRole, revision])}`,
    errorMessage: 'Could not load the library count.',
    fetcher: async () => {
      const response = await api.get('/user/meals/verified-recipes/summary', {
        params: {
          ...(search.trim() ? { search: search.trim() } : {}),
          ...(mealType !== 'All' ? { mealType } : {}),
          ...(riceRole !== 'All' ? { riceRole } : {}),
        },
      });
      const data = response.data?.data;
      if (
        !response.data?.success ||
        !Number.isSafeInteger(data?.total) ||
        data.total < 0 ||
        typeof data.restrictedProfile !== 'boolean' ||
        (data.restrictedProfile &&
          (!Array.isArray(data.eligibleIds) ||
            data.eligibleIds.length !== data.total ||
            data.eligibleIds.some((id: unknown) => typeof id !== 'string') ||
            new Set(data.eligibleIds).size !== data.total))
      )
        throw new Error('Could not load the library count.');
      return data;
    },
  });
  let total: number | null = enabled ? (query.data?.total ?? null) : null;
  if (total !== null && query.data?.restrictedProfile) {
    const plannedIds = new Set(meals.map((meal) => meal.libraryMealId).filter(Boolean));
    const planned = groupApprovedPlanRecipes(
      meals.filter(
        (meal) =>
          meal.status === 'APPROVED' &&
          riceRole === 'All' &&
          (mealType === 'All' || meal.mealType === mealType) &&
          (!search.trim() || meal.mealName.toLowerCase().includes(search.trim().toLowerCase()))
      )
    );
    total = planned.length + query.data.eligibleIds!.filter((id) => !plannedIds.has(id)).length;
  }
  return { total, error: query.error, refresh: query.refetch };
}

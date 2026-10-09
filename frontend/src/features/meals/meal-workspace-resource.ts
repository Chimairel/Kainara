import api from '@/lib/axios';
import { refreshSessionResource } from '@/lib/session-resource-cache';
import type { CurrentPlanSnapshot } from './meals-workspace.types';

export const MEALS_WORKSPACE_RESOURCE = 'user-meals-workspace';

export function refreshMealsWorkspace(ownerId: string | undefined, signal?: AbortSignal) {
  return refreshSessionResource<CurrentPlanSnapshot>(ownerId, MEALS_WORKSPACE_RESOURCE, async () => {
    const response = signal
      ? await api.get('/user/meals/workspace', { signal })
      : await api.get('/user/meals/workspace');
    if (!response.data?.success || !Array.isArray(response.data.data)) {
      throw new Error('Invalid meal workspace response.');
    }
    return {
      meals: response.data.data,
      retainedMealLogs: response.data.meta?.retainedMealLogs ?? [],
      pendingReview: response.data.meta?.pendingReview ?? null,
      awaitingGeneration: response.data.meta?.awaitingGeneration ?? { current: 0, upcoming: 0 },
      generationStatus: response.data.meta?.generationStatus ?? { current: null, upcoming: null },
      cycles: response.data.meta?.cycles ?? null,
    };
  });
}

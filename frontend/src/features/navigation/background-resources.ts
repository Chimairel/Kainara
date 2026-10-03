import { fetchGroceryWorkspace } from '@/features/grocery/current-grocery';
import { MEALS_WORKSPACE_RESOURCE, refreshMealsWorkspace } from '@/features/meals/meal-workspace-resource';
import {
  invalidateSessionResource,
  isSessionResourceRecent,
  refreshSessionResource,
} from '@/lib/session-resource-cache';

export const GROCERY_WORKSPACE_RESOURCE = 'user-grocery-workspace';
const resources = [MEALS_WORKSPACE_RESOURCE, GROCERY_WORKSPACE_RESOURCE];
const controllers = new Map<string, Set<AbortController>>();

export function invalidateBackgroundResources(ownerId: string) {
  resources.forEach((resource) => invalidateSessionResource(ownerId, resource));
}

export function cancelBackgroundResources(ownerId: string) {
  controllers.get(ownerId)?.forEach((controller) => controller.abort());
  controllers.delete(ownerId);
  invalidateBackgroundResources(ownerId);
}

/** One read at a time; navigation can adopt the active request through the session cache. */
export async function preloadBackgroundResources(ownerId: string, mayContinue: () => boolean) {
  for (const resource of resources) {
    if (!mayContinue()) return;
    if (isSessionResourceRecent(ownerId, resource, 30_000)) continue;
    const controller = new AbortController();
    const owned = controllers.get(ownerId) ?? new Set<AbortController>();
    controllers.set(ownerId, owned);
    owned.add(controller);
    try {
      if (resource === MEALS_WORKSPACE_RESOURCE) {
        await refreshMealsWorkspace(ownerId, controller.signal);
      } else {
        await refreshSessionResource(ownerId, resource, () => fetchGroceryWorkspace(controller.signal));
      }
    } catch {
      // Optional work stays quiet and stops on failure; the page retains its normal retry path.
      return;
    } finally {
      owned.delete(controller);
      if (owned.size === 0 && controllers.get(ownerId) === owned) controllers.delete(ownerId);
    }
  }
}

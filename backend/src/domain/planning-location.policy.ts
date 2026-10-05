import { classifyIngredientIntoEnnsFoodGroup, type EnnsFoodGroupCode } from '@/domain/enns-food-group.policy';

export type PlanningGeographyLevel = 'NATIONAL' | 'REGION' | 'PROVINCE_HUC';

export interface PlanningLocation {
  planningGeographyLevel?: PlanningGeographyLevel | null;
  planningRegionName?: string | null;
  planningProvinceHucName?: string | null;
}

export interface ConsumptionScope {
  level: PlanningGeographyLevel;
  regionName: string | null;
  provinceHucName: string | null;
  label: string;
}

export interface ScopedConsumptionResult<T> {
  scope: ConsumptionScope | null;
  rows: T[];
}

interface MealWithGroundedIngredients {
  ingredients: Array<{
    foodItemId?: string | null;
    ingredientName?: string | null;
    name?: string | null;
    category?: string | null;
    foodItem?: { name?: string | null; category?: string | null } | null;
  }>;
}

function clean(value?: string | null): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

/**
 * Produces the only allowed locality fallback order. Location is deliberately
 * coarse and affects familiarity evidence only; it is not a clinical input.
 */
export function buildConsumptionScopeChain(location?: PlanningLocation | null): ConsumptionScope[] {
  const level =
    location?.planningGeographyLevel ??
    (location?.planningProvinceHucName ? 'PROVINCE_HUC' : location?.planningRegionName ? 'REGION' : 'NATIONAL');
  const regionName = clean(location?.planningRegionName);
  const provinceHucName = clean(location?.planningProvinceHucName);
  const scopes: ConsumptionScope[] = [];

  if (level === 'PROVINCE_HUC' && regionName && provinceHucName) {
    scopes.push({
      level: 'PROVINCE_HUC',
      regionName,
      provinceHucName,
      label: `${provinceHucName}, ${regionName}`,
    });
  }

  if (level !== 'NATIONAL' && regionName) {
    scopes.push({ level: 'REGION', regionName, provinceHucName: null, label: regionName });
  }

  scopes.push({ level: 'NATIONAL', regionName: null, provinceHucName: null, label: 'Philippines (national)' });
  return scopes;
}

export function formatPlanningLocation(location?: PlanningLocation | null): string {
  const regionName = clean(location?.planningRegionName);
  const provinceHucName = clean(location?.planningProvinceHucName);
  if (location?.planningGeographyLevel === 'NATIONAL') return 'Philippines';
  if (location?.planningGeographyLevel !== 'REGION' && provinceHucName && regionName)
    return `${provinceHucName}, ${regionName}`;
  return regionName ?? 'Philippines';
}

/**
 * Resolves aggregate evidence through the approved locality chain and stops at
 * the first scope that actually has rows. Keeping this decision pure and
 * injectable makes the fallback behavior deterministic and independently
 * testable without a database.
 */
export async function resolveFirstAvailableConsumptionScope<T>(
  location: PlanningLocation | null | undefined,
  loadRows: (scope: ConsumptionScope) => Promise<T[]>
): Promise<ScopedConsumptionResult<T>> {
  for (const scope of buildConsumptionScopeChain(location)) {
    const rows = await loadRows(scope);
    if (rows.length > 0) return { scope, rows };
  }

  return { scope: null, rows: [] };
}

/**
 * Applies locality only after callers have completed their safety and calorie
 * eligibility filters. The stable sort preserves the caller's existing
 * ranking among meals with equal grounded-local ingredient coverage.
 */
export function rankMealsByLocalizedFoodEvidence<TMeal extends MealWithGroundedIngredients>(
  meals: readonly TMeal[],
  localizedFoodIds: ReadonlySet<string>,
  localizedFoodGroupScores: ReadonlyMap<EnnsFoodGroupCode, number> = new Map()
): TMeal[] {
  const score = (meal: TMeal) => {
    const matchedGroups = new Set<EnnsFoodGroupCode>();
    let total = 0;
    for (const ingredient of meal.ingredients) {
      if (ingredient.foodItemId && localizedFoodIds.has(ingredient.foodItemId)) total += 1;
      const group = classifyIngredientIntoEnnsFoodGroup({
        name: ingredient.foodItem?.name ?? ingredient.ingredientName ?? ingredient.name,
        category: ingredient.foodItem?.category ?? ingredient.category,
      });
      if (group) matchedGroups.add(group);
    }
    for (const group of matchedGroups) total += localizedFoodGroupScores.get(group) ?? 0;
    return total;
  };

  return [...meals].sort((left, right) => score(right) - score(left));
}

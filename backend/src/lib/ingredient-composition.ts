import type { FoodItem } from '@prisma/client';
import { createUsdaCompositionMatcher, USDA_FDC_SOURCE } from '@/domain/usda-food-composition.policy';
import { lookupFnriIdentities } from '@/lib/fnri';
import prisma from '@/lib/prisma';
import { catalogueMatchingCache } from './catalogue-matching-cache';

type IngredientCompositionFood = Pick<FoodItem, 'id' | 'name' | 'category' | 'source'>;
const getUsdaFoods = catalogueMatchingCache<IngredientCompositionFood[]>(
  () =>
    prisma.foodItem.findMany({
      where: { source: USDA_FDC_SOURCE },
      select: { id: true, name: true, category: true, source: true },
    }),
  (foods) => foods.length > 0
);

/** FNRI first. USDA is limited to unambiguous exact records and verified aliases. */
export async function lookupIngredientCompositions(
  names: readonly string[]
): Promise<Map<string, IngredientCompositionFood | null>> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  const fnri = await lookupFnriIdentities(unique);
  const resolved = new Map<string, IngredientCompositionFood | null>(fnri);
  const unresolved = unique.filter((name) => !fnri.get(name));
  if (!unresolved.length) return resolved;
  const [foods, aliases] = await Promise.all([
    getUsdaFoods(),
    prisma.foodAlias.findMany({
      where: { verifiedAt: { not: null }, foodItem: { source: USDA_FDC_SOURCE } },
      select: { alias: true, foodItemId: true, verifiedAt: true },
    }),
  ]);
  const match = createUsdaCompositionMatcher(foods, aliases);
  for (const name of unresolved) resolved.set(name, match(name));
  return resolved;
}

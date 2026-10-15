import { getManilaDateKey } from './meal-plan-cycle.policy';
import { aggregateGroceryIngredients, type GroceryIngredientInput } from './grocery-quantity.policy';

type GroceryMeal = {
  scheduledDate: Date;
  ingredients: GroceryIngredientInput[];
  servingComponents: Array<{ quantityG: number | null; foodItem: { name: string; category: string | null } | null }>;
};

/** Same ingredient and rice basis as the cycle checklist. Never infer pantry stock. */
export function groceryMealIngredients(meals: readonly GroceryMeal[]): GroceryIngredientInput[] {
  return meals.flatMap(meal => [
    ...meal.ingredients,
    ...meal.servingComponents.flatMap(component => component.foodItem && component.quantityG
      ? [{ ingredientName: component.foodItem.name, category: component.foodItem.category || 'Rice and grains', quantity: component.quantityG, unit: 'g' }]
      : []),
  ]);
}

/** Caller supplies only currently cleared, owner/cycle-scoped meals. Day quantities are read-only. */
export function buildGroceryDays(meals: readonly GroceryMeal[], start: Date, end: Date) {
  const first = getManilaDateKey(start), last = getManilaDateKey(end);
  const days = [];
  for (let date = first, n = 0; date <= last && n < 31; n++) {
    const selected = meals.filter(meal => getManilaDateKey(meal.scheduledDate) === date);
    days.push({ date, clearedMealCount: selected.length, items: aggregateGroceryIngredients(groceryMealIngredients(selected)) });
    date = new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
  }
  return days;
}

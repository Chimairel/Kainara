import { describe, expect, it } from 'vitest';
import { formatGroceryItemDisplay, getCategoryStyle } from './grocery-display';
import type { GroceryItem } from './current-grocery';

describe('formatGroceryItemDisplay', () => {
  it('cleans up inverted parenthesized titles with unit as the food item', () => {
    const item: GroceryItem = {
      id: '1',
      ingredientName: '(hard boiled, sliced or wedged)',
      category: 'Eggs',
      isChecked: false,
      quantity: 0.67,
      unit: 'eggs',
      sourceMealCount: 1,
      isPantryStaple: false,
    };

    const result = formatGroceryItemDisplay(item);
    expect(result.cleanName).toBe('Eggs');
    expect(result.prepNote).toBe('hard boiled, sliced or wedged');
    expect(result.displayQuantity).toBe('1 pc');
    expect(result.recipeBadge).toBe('Used in 1 meal');
  });

  it('extracts embedded quantities and prep notes from raw titles', () => {
    const item: GroceryItem = {
      id: '2',
      ingredientName: '1/2 cup cheddar cheese (grated)',
      category: 'Dairy',
      isChecked: false,
      quantity: null,
      unit: null,
      sourceMealCount: 2,
      isPantryStaple: false,
    };

    const result = formatGroceryItemDisplay(item);
    expect(result.cleanName).toBe('Cheddar cheese');
    expect(result.prepNote).toBe('grated');
    expect(result.displayQuantity).toBe('½ cup');
    expect(result.recipeBadge).toBe('Used in 2 meals');
  });

  it('extracts trailing parenthesized prep notes for standard measured items', () => {
    const item: GroceryItem = {
      id: '3',
      ingredientName: 'Bell pepper (minced)',
      category: 'Vegetables',
      isChecked: false,
      quantity: 0.25,
      unit: 'red',
      sourceMealCount: 1,
      isPantryStaple: false,
    };

    const result = formatGroceryItemDisplay(item);
    expect(result.cleanName).toBe('Bell pepper');
    expect(result.prepNote).toBe('minced');
    expect(result.displayQuantity).toBe('¼ red');
  });

  it('formats large gram and ml amounts into kg and L', () => {
    const item: GroceryItem = {
      id: '4',
      ingredientName: 'Chicken breast',
      category: 'Meat',
      isChecked: false,
      quantity: 1200,
      unit: 'g',
      sourceMealCount: 3,
      isPantryStaple: false,
    };

    const result = formatGroceryItemDisplay(item);
    expect(result.cleanName).toBe('Chicken breast');
    expect(result.displayQuantity).toBe('1.2 kg');
    expect(result.recipeBadge).toBe('Used in 3 meals');
  });

  it('handles unmeasured items gracefully without awkward default messages', () => {
    const item: GroceryItem = {
      id: '5',
      ingredientName: 'Salt',
      category: 'Pantry',
      isChecked: false,
      quantity: null,
      unit: null,
      sourceMealCount: 1,
      isPantryStaple: true,
    };

    const result = formatGroceryItemDisplay(item);
    expect(result.cleanName).toBe('Salt');
    expect(result.displayQuantity).toBe('As needed');
  });
});

describe('getCategoryStyle', () => {
  it('returns appropriate theme style and icon name for categories', () => {
    expect(getCategoryStyle('Fresh Produce').iconName).toBe('produce');
    expect(getCategoryStyle('Meat & Poultry').iconName).toBe('meat');
    expect(getCategoryStyle('Fish & Seafood').iconName).toBe('seafood');
    expect(getCategoryStyle('Eggs').iconName).toBe('dairy');
    expect(getCategoryStyle('Grains, Cereals & Carbs').iconName).toBe('grains');
    expect(getCategoryStyle('Pantry Staples').iconName).toBe('pantry');
  });
});

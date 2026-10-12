import { describe, expect, it } from 'vitest';
import { formatMealTitle } from './meal-title';

describe('source recipe display titles', () => {
  it.each([
    ['How to Make French Toast - The Basic Recipe', 'French Toast'],
    ['How to Cook Beef Stroganoff', 'Beef Stroganoff'],
    ['How to Prepare Chicken Adobo Recipe', 'Chicken Adobo'],
    ['French Toast – The Basic Recipe', 'French Toast'],
    ['Basic Tortang Talong', 'Basic Tortang Talong'],
    ['Recipe for Barbecue Chicken Marinade', 'Barbecue Chicken Marinade'],
    ['Super Easy Pork Burger', 'Pork Burger'],
    ['Best Game Day Chili Recipe', 'Game Day Chili'],
    ['Yummy Blueberry Pancake Recipe', 'Blueberry Pancake'],
    ['Sweet and Sour Tofu', 'Sweet and Sour Tofu'],
    ['Ginarep Recipe (Shrimp and Corn Soup)', 'Ginarep (Shrimp and Corn Soup)'],
    ['Lumpiang Sariwa (Fresh Spring Rolls Recipe)', 'Lumpiang Sariwa (Fresh Spring Rolls)'],
    ['Beef Broccoli Recipe with Carrots', 'Beef Broccoli with Carrots'],
    ['Easy Sisig Recipes', 'Sisig'],
    ['Quick and Easy Beef and Pepper Stir Fry Recipe', 'Beef and Pepper Stir Fry'],
    ['How to Grill Salmon', 'Grilled Salmon'],
    ['How to Can Tomatoes', 'Canned Tomatoes'],
    ['How to Make the Perfect Mashed Potatoes', 'Mashed Potatoes'],
    ['Simple Syrup Recipe', 'Simple Syrup'],
    ['Homemade Pork Tocino', 'Homemade Pork Tocino'],
    ['How to Make', 'How to Make'],
  ])('formats %s without changing the source input', (source, display) => {
    expect(formatMealTitle(source)).toBe(display);
    expect(formatMealTitle(source)).toBe(display);
  });
});

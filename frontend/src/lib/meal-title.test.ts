import { describe, expect, it } from 'vitest';
import { formatMealTitle } from './meal-title';

describe('source recipe display titles', () => {
  it.each([
    ['How to Make French Toast - The Basic Recipe', 'French Toast'],
    ['How to Cook Beef Stroganoff', 'Beef Stroganoff'],
    ['How to Prepare Chicken Adobo Recipe', 'Chicken Adobo'],
    ['French Toast – The Basic Recipe', 'French Toast'],
    ['Basic Tortang Talong', 'Basic Tortang Talong'],
    ['Recipe for Success', 'Recipe for Success'],
    ['Sweet and Sour Tofu', 'Sweet and Sour Tofu'],
    ['Ginarep Recipe (Shrimp and Corn Soup)', 'Ginarep Recipe (Shrimp and Corn Soup)'],
    ['How to Make', 'How to Make'],
  ])('formats %s without changing the source input', (source, display) => {
    expect(formatMealTitle(source)).toBe(display);
    expect(formatMealTitle(source)).toBe(display);
  });
});

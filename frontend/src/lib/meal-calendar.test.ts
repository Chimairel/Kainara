import { expect, it } from 'vitest';
import { groupMealsByManilaDate } from './meal-calendar';

it('keeps screen and print meals on the same Philippine day across UTC midnight', () => {
  const meals = [
    { id: 'lunch', scheduledDate: '2026-10-12T04:00:00Z' },
    { id: 'breakfast', scheduledDate: '2026-10-11T23:00:00Z' },
    { id: 'previous', scheduledDate: '2026-10-11T15:59:00Z' },
  ];
  const original = [...meals];
  const screen = groupMealsByManilaDate(meals);
  const print = groupMealsByManilaDate(meals, { month: 'short', day: 'numeric', year: 'numeric' });
  expect(screen.map((day) => day.dateKey)).toEqual(['2026-10-11', '2026-10-12']);
  expect(print.map((day) => day.dateKey)).toEqual(screen.map((day) => day.dateKey));
  expect(print[1].weekday).toBe('Monday');
  expect(print[1].dateStr).toBe('Oct 12, 2026');
  expect(print[1].mealsList.map((meal) => meal.id)).toEqual(['lunch', 'breakfast']);
  expect(meals).toEqual(original);
});

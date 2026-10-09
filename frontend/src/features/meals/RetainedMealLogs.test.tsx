import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import RetainedMealLogs from './RetainedMealLogs';
import PreviousPlanPurchases from '../grocery/PreviousPlanPurchases';

it('renders only the selected date, preserves eaten/skipped status and offers no mutation controls', () => {
  const meal = {
    id: 'old',
    mealName: 'Saved plate',
    mealType: 'LUNCH',
    scheduledDate: '2026-10-03T04:00:00Z',
    calories: 650,
    proteinG: 24,
    carbsG: 99,
    fatG: 21,
    status: 'DONE' as const,
  };
  render(
    <RetainedMealLogs
      meals={[
        meal,
        { ...meal, id: 'skip', mealName: 'Skipped plate', status: 'SKIPPED' },
        { ...meal, id: 'other', mealName: 'Other date', scheduledDate: '2026-10-04T04:00:00Z' },
      ]}
      dateKey="2026-10-03"
    />
  );
  expect(screen.getByText('Eaten · 650 kcal')).toBeInTheDocument();
  expect(screen.getByText('Skipped')).toBeInTheDocument();
  expect(screen.queryByText('Other date')).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('previous purchases show recorded quantities without marking new items available', () => {
  render(<PreviousPlanPurchases items={[{ ingredientName: 'Rice', quantity: 250, unit: 'g' }]} />);
  expect(screen.getByText('Previous plan purchases')).toBeInTheDocument();
  expect(screen.getByText('250 g')).toBeInTheDocument();
  expect(screen.getByText(/Confirm what remains/)).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});

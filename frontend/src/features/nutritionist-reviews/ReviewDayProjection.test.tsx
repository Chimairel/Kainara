import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import ReviewDayProjection from './ReviewDayProjection';
import type { ReviewNutritionTargets } from './review-nutrition-targets';

const targets: ReviewNutritionTargets = { meal: null, daily: null, rules: [],
  ranges: { proteinG: { minimum: 20, maximum: 30, dailyMinimum: 50, dailyMaximum: 75 } },
  plannedDay: { otherTotals: { calories: 1200, proteinG: 40, carbsG: 160, fatG: 30 }, complete: true, missingMealTypes: [], ambiguous: false },
};
it('adds replacement to the other meals exactly once and checks the unrounded daily range', () => {
  const { rerender } = render(<ReviewDayProjection targets={targets} after={{ proteinG: 25 }} />);
  expect(screen.getByText('All 3 meals included')).toBeVisible();
  expect(screen.getByRole('row', { name: 'Protein 65 g 50–75 g Within range', hidden: true })).toBeInTheDocument();
  rerender(<ReviewDayProjection targets={targets} after={{ proteinG: 35.001 }} />);
  expect(screen.getByRole('row', { name: 'Protein 75 g 50–75 g Above range', hidden: true })).toBeInTheDocument();
});
it('never labels an incomplete or conflicting planned day within range', () => {
  const { rerender } = render(<ReviewDayProjection targets={{ ...targets, plannedDay: { ...targets.plannedDay!, complete: false, missingMealTypes: ['DINNER'] } }} after={{ proteinG: 25 }} />);
  const table = screen.getByRole('table', { name: 'Projected daily nutrition', hidden: true });
  expect(within(table).queryByText('Within range')).not.toBeInTheDocument();
  expect(screen.getByRole('row', { name: 'Protein 65 g 50–75 g Incomplete day', hidden: true })).toBeInTheDocument();
  rerender(<ReviewDayProjection targets={{ ...targets, plannedDay: { ...targets.plannedDay!, otherTotals: null, complete: false, ambiguous: true } }} after={{ proteinG: 25 }} />);
  expect(screen.getByRole('row', { name: 'Protein Not available 50–75 g Unavailable', hidden: true })).toBeInTheDocument();
});

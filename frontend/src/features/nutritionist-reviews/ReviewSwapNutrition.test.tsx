import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import ReviewSwapNutrition from './ReviewSwapNutrition';

it('shows a saved guidance reference with its basis without relabeling it as an approved rule', () => {
  render(<ReviewSwapNutrition before={{ sodiumMg: 300 }} after={{ sodiumMg: 450 }} targets={{ daily: null, meal: null, rules: [],
    guidance: [{ nutrient: 'sodiumMg', value: '2,300 mg/day', explanation: 'The appropriate target requires individual selection.',
      sourceTitle: 'Saved DASH reference', sourceUrl: 'https://example.test/dash' }] }} />);
  const sodium = screen.getByRole('row', { name: /Sodium 300 mg 450 mg/ });
  expect(sodium).toHaveTextContent('2,300 mg/day');
  expect(sodium).toHaveTextContent('Guidance reference');
  expect(sodium).not.toHaveTextContent('Approved rule');
});

it('keeps per-meal macros, daily rules and search-only limits distinct', () => {
  render(<ReviewSwapNutrition before={{ calories: 700, sodiumMg: 400, sugarG: 0 }} after={{ calories: 800, sodiumMg: 600, sugarG: 2 }}
    targets={{ meal: { calories: 800, proteinG: 25, carbsG: 125, fatG: 22.2 },
      daily: { calories: 2000, proteinG: 62.5, carbsG: 312.5, fatG: 55.6, basis: 'REVIEW_REFERENCE', explanation: 'Recorded planning reference.' },
      rules: [{ nutrient: 'sodiumMg', value: 2000, operator: 'LESS_THAN', unit: 'mg/day', basis: 'DAY',
        condition: 'HYPERTENSION', sourceTitle: 'Recorded source', sourceUrl: 'https://example.test/source' }] }}
    filters={{ sodiumMg: { max: 500 }, sugarG: { max: 5, maxExclusive: true } }} />);
  expect(screen.getAllByRole('columnheader', { name: 'Target' })).toHaveLength(2);
  expect(screen.getByRole('row', { name: 'Energy 700 kcal 800 kcal 800 kcal' })).toBeInTheDocument();
  const sodium = screen.getByRole('row', { name: /Sodium 400 mg 600 mg/ });
  expect(sodium).toHaveTextContent('< 2000 mg/day');
  expect(sodium).toHaveTextContent('Search: ≤ 500 mg / meal');
  expect(sodium).not.toHaveTextContent('≤ 500 mg/day');
  const sugar = screen.getByRole('row', { name: /Sugar 0 g 2 g/ });
  expect(sugar).toHaveTextContent('Not set');
  expect(sugar).toHaveTextContent('Search: < 5 g / meal');
  expect(screen.getByRole('link', { name: 'Recorded source', hidden: true })).toHaveAttribute('href', 'https://example.test/source');
});

it('keeps missing nutrients and targets unknown rather than inventing zeros or reference limits', () => {
  render(<ReviewSwapNutrition before={{ calories: 400 }} after={{ calories: 500 }} />);
  const sodium = screen.getByRole('row', { name: 'Sodium Not recorded Not recorded Not set' });
  expect(within(sodium).getAllByText('Not recorded')).toHaveLength(2);
  expect(sodium).not.toHaveTextContent('0 mg');
  expect(screen.getByRole('row', { name: 'Energy 400 kcal 500 kcal Not set' })).toBeInTheDocument();
});

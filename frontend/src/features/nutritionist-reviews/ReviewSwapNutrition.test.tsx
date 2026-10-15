import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import ReviewSwapNutrition from './ReviewSwapNutrition';

it('labels exact sodium as equality while displaying the rounded stored meal value', () => {
  render(<ReviewSwapNutrition before={{ sodiumMg: 986.3 }} after={{ sodiumMg: 466.831 }}
    filters={{ sodiumMg: { min: 466.8, max: 466.8 } }} />);
  const sodium = screen.getByRole('row', { name: /Sodium 986.3 mg 466.8 mg/ });
  expect(sodium).toHaveTextContent('Search: = 466.8 mg / meal');
  expect(sodium).not.toHaveTextContent('≥');
});

it('shows a saved guidance reference with its basis without relabeling it as an approved rule', () => {
  render(<ReviewSwapNutrition before={{ sodiumMg: 300 }} after={{ sodiumMg: 450 }} targets={{ daily: null, meal: null, rules: [],
    guidance: [{ nutrient: 'sodiumMg', value: '2,300 mg/day', explanation: 'The appropriate target requires individual selection.',
      sourceTitle: 'Saved DASH reference', sourceUrl: 'https://example.test/dash' }] }} />);
  const sodium = screen.getByRole('row', { name: /Sodium 300.0 mg 450.0 mg/ });
  expect(sodium).toHaveTextContent('2,300 mg/day');
  expect(sodium).toHaveTextContent('Guidance reference');
  expect(sodium).not.toHaveTextContent('Approved rule');
});

it('keeps per-meal macros, daily rules and search-only limits distinct', () => {
  render(<ReviewSwapNutrition before={{ calories: 700, sodiumMg: 400, sugarG: 0 }} after={{ calories: 800, sodiumMg: 600, sugarG: 2 }}
    targets={{ meal: { calories: 800, proteinG: 25, carbsG: 125, fatG: 22.2 }, mealShare: 0.4, mealEnergyRange: { minimum: 680, maximum: 920, target: 800 },
      daily: { calories: 2000, proteinG: 62.5, carbsG: 312.5, fatG: 55.6, basis: 'REVIEW_REFERENCE', explanation: 'Recorded planning reference.' },
      rules: [{ nutrient: 'sodiumMg', value: 2000, operator: 'LESS_THAN', unit: 'mg/day', basis: 'DAY',
        condition: 'HYPERTENSION', sourceTitle: 'Recorded source', sourceUrl: 'https://example.test/source' }] }}
    filters={{ sodiumMg: { max: 500 }, sugarG: { max: 5, maxExclusive: true } }} />);
  expect(screen.getByRole('columnheader', { name: 'Meal planning range' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Target' })).toBeInTheDocument();
  expect(screen.getByRole('row', { name: 'Energy 700.0 kcal 800.0 kcal 680.0–920.0 kcal' })).toBeInTheDocument();
  const sodium = screen.getByRole('row', { name: /Sodium 400.0 mg 600.0 mg/ });
  expect(sodium).toHaveTextContent('< 2000.0 mg/day');
  expect(sodium).toHaveTextContent('Search: ≤ 500.0 mg / meal');
  expect(sodium).not.toHaveTextContent('≤ 500.0 mg/day');
  const sugar = screen.getByRole('row', { name: /Sugar 0.0 g 2.0 g/ });
  expect(sugar).toHaveTextContent('Not set');
  expect(sugar).toHaveTextContent('Search: < 5.0 g / meal');
  expect(screen.getByRole('link', { name: 'Recorded source', hidden: true })).toHaveAttribute('href', 'https://example.test/source');
});

it('keeps missing nutrients and targets unknown rather than inventing zeros or reference limits', () => {
  render(<ReviewSwapNutrition before={{ calories: 400 }} after={{ calories: 500 }} />);
  const sodium = screen.getByRole('row', { name: 'Sodium Not recorded Not recorded Not set' });
  expect(within(sodium).getAllByText('Not recorded')).toHaveLength(2);
  expect(sodium).not.toHaveTextContent('0.0 mg');
  expect(screen.getByRole('row', { name: 'Energy 400.0 kcal 500.0 kcal Not set' })).toBeInTheDocument();
});

it('shows allocated meal ranges in the comparison and keeps daily ranges and planning points under details', () => {
  render(<ReviewSwapNutrition before={{ proteinG: 20, carbsG: 80, fatG: 15 }} after={{ proteinG: 25, carbsG: 90, fatG: 20 }}
    targets={{ daily: null, meal: { proteinG: 25, carbsG: 125, fatG: 22.2 }, mealShare: 0.4, ranges: {
      proteinG: { minimum: 20, maximum: 30, dailyMinimum: 50, dailyMaximum: 75 },
      carbsG: { minimum: 110, maximum: 150, dailyMinimum: 275, dailyMaximum: 375 },
      fatG: { minimum: 13.32, maximum: 26.68, dailyMinimum: 33.3, dailyMaximum: 66.7 },
    }, rules: [],
      guidance: [
        { nutrient: 'proteinG', value: '50–75 g/day', explanation: 'Saved population range.', sourceTitle: 'Saved macro source', sourceUrl: 'https://example.test/macros' },
        { nutrient: 'carbsG', value: '275–375 g/day', explanation: 'Saved carbohydrate range.', sourceTitle: 'Saved macro source', sourceUrl: 'https://example.test/macros' },
        { nutrient: 'fatG', value: '33.3–66.7 g/day', explanation: 'Saved fat range.', sourceTitle: 'Saved macro source', sourceUrl: 'https://example.test/macros' },
      ] }} />);
  const protein = screen.getByRole('row', { name: /Protein 20.0 g 25.0 g/ });
  expect(protein).toHaveTextContent('20.0–30.0 g');
  expect(protein).not.toHaveTextContent('g/day');
  expect(protein).not.toHaveTextContent('Planning point');
  expect(screen.getByRole('row', { name: /Carbohydrates 80.0 g 90.0 g/ })).toHaveTextContent('110.0–150.0 g');
  expect(screen.getByRole('row', { name: /Fat 15.0 g 20.0 g/ })).toHaveTextContent('13.3–26.7 g');
  expect(screen.getByText(/50–75 g\/day: Saved population range/)).not.toBeVisible();
  expect(screen.getByText(/Meal planning point:/)).not.toBeVisible();
  expect(screen.getAllByRole('link', { name: 'Saved macro source', hidden: true })).toHaveLength(3);
});

it('preserves an approved protein limit alongside the saved reference and never invents missing ranges', () => {
  render(<ReviewSwapNutrition before={{ proteinG: 20 }} after={{ proteinG: 25 }} targets={{ daily: null,
    meal: { proteinG: 25, fatG: 22.2 }, rules: [{ nutrient: 'proteinG', value: 48, operator: 'LESS_THAN_OR_EQUAL', unit: 'g/day',
      basis: 'DAY', condition: 'KIDNEY_DISEASE', sourceTitle: 'Saved rule', sourceUrl: 'https://example.test/rule' }] }} />);
  const protein = screen.getByRole('row', { name: /Protein 20.0 g 25.0 g/ });
  expect(protein).toHaveTextContent('Not set');
  expect(screen.getByRole('list', { name: 'Recorded macro limits' })).toHaveTextContent('Protein ≤ 48.0 g/day');
  expect(screen.getByRole('row', { name: /Fat Not recorded Not recorded/ })).toHaveTextContent('Not set');
});

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
  expect(screen.getByRole('columnheader', { name: 'Reference / target' })).toBeInTheDocument();
  expect(screen.getByRole('columnheader', { name: 'Target' })).toBeInTheDocument();
  expect(screen.getByRole('row', { name: 'Energy 700 kcal 800 kcal Planning point: 800 kcal/meal' })).toBeInTheDocument();
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

it('shows saved daily macro ranges unchanged and labels meal planning points separately', () => {
  render(<ReviewSwapNutrition before={{ proteinG: 20, carbsG: 80, fatG: 15 }} after={{ proteinG: 25, carbsG: 90, fatG: 20 }}
    targets={{ daily: null, meal: { proteinG: 25, carbsG: 125, fatG: 22.2 }, rules: [],
      guidance: [
        { nutrient: 'proteinG', value: '50–75 g/day', explanation: 'Saved population range.', sourceTitle: 'Saved macro source', sourceUrl: 'https://example.test/macros' },
        { nutrient: 'carbsG', value: '275–375 g/day', explanation: 'Saved carbohydrate range.', sourceTitle: 'Saved macro source', sourceUrl: 'https://example.test/macros' },
        { nutrient: 'fatG', value: '33.3–66.7 g/day', explanation: 'Saved fat range.', sourceTitle: 'Saved macro source', sourceUrl: 'https://example.test/macros' },
      ] }} />);
  const protein = screen.getByRole('row', { name: /Protein 20 g 25 g/ });
  expect(protein).toHaveTextContent('50–75 g/day');
  expect(protein).toHaveTextContent('Saved daily reference');
  expect(protein).toHaveTextContent('Planning point: 25 g/meal');
  expect(protein).not.toHaveTextContent('20–30 g/meal');
  expect(screen.getByRole('row', { name: /Carbohydrates 80 g 90 g/ })).toHaveTextContent('275–375 g/day');
  expect(screen.getByRole('row', { name: /Fat 15 g 20 g/ })).toHaveTextContent('33.3–66.7 g/day');
  expect(screen.getAllByRole('link', { name: 'Saved macro source', hidden: true })).toHaveLength(3);
});

it('preserves an approved protein limit alongside the saved reference and never invents missing ranges', () => {
  render(<ReviewSwapNutrition before={{ proteinG: 20 }} after={{ proteinG: 25 }} targets={{ daily: null,
    meal: { proteinG: 25, fatG: 22.2 }, rules: [{ nutrient: 'proteinG', value: 48, operator: 'LESS_THAN_OR_EQUAL', unit: 'g/day',
      basis: 'DAY', condition: 'KIDNEY_DISEASE', sourceTitle: 'Saved rule', sourceUrl: 'https://example.test/rule' }] }} />);
  const protein = screen.getByRole('row', { name: /Protein 20 g 25 g/ });
  expect(protein).toHaveTextContent('≤ 48 g/day');
  expect(protein).toHaveTextContent('Approved rule');
  expect(protein).toHaveTextContent('Planning point: 25 g/meal');
  expect(screen.getByRole('row', { name: /Fat Not recorded Not recorded/ })).toHaveTextContent('No saved range');
});

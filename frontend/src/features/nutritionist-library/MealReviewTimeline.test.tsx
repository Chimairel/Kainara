import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import MealReviewTimeline, { type ReviewIncident } from './MealReviewTimeline';

const meal = {
  id: 'meal',
  mealName: 'Measured soup',
  calories: 600,
  proteinG: 30,
  carbsG: 60,
  fatG: 15,
  sodiumMg: null,
  nutritionServingDescription: '300 g serving',
  ingredients: [{ ingredientName: 'Squash', quantity: 300, unit: 'g' }],
};
const report = {
  id: 'flag-1',
  createdAt: '2026-10-08T00:00:00Z',
  actorSnapshot: { name: 'Flagger', role: 'RND' },
  notes: {
    category: 'NUTRITION',
    affectedFields: ['quantity'],
    explanation: 'Check the measured edible portion.',
    reference: 'Recorded composition reference.',
    proposedCorrection: 'Reconcile the grams per serving.',
  },
};
const decision = (id: string, action: string, calories: number) => ({
  id,
  action,
  createdAt: '2026-10-08T00:00:00Z',
  actorSnapshot: { name: 'Reviewer', role: 'RND' },
  rationale: `Recorded ${action} findings.`,
  version: id.padEnd(64, 'a'),
  snapshot: { meals: [{ ...meal, calories }] },
});
const history: ReviewIncident[] = [
  {
    id: 'incident-1',
    number: 1,
    state: 'RELEASED',
    reports: [report],
    decisions: [
      decision('original', 'WITHHELD', 600),
      decision('before', 'CORRECTION_BEFORE', 600),
      {
        ...decision('after', 'CORRECTED', 650),
        snapshot: {
          meals: [
            {
              ...meal,
              calories: 650,
              nutritionServingDescription: '325 g serving',
              ingredients: [{ ingredientName: 'Squash', quantity: 325, unit: 'g' }],
            },
          ],
        },
      },
    ],
  },
  {
    id: 'incident-2',
    number: 2,
    state: 'QUARANTINED',
    reports: [{ ...report, id: 'flag-2', notes: { ...report.notes, explanation: 'Second recorded concern.' } }],
    decisions: [decision('latest', 'FLAGGED', 650)],
  },
];

function selectChange(name: RegExp) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Review change' }));
  fireEvent.click(screen.getByRole('option', { name }));
}

it('selects immutable changes across incidents without substituting current nutrition', () => {
  render(<MealReviewTimeline history={history} legacyHistoryUnknown={false} />);
  expect(screen.getByRole('combobox', { name: 'Review change' })).toHaveTextContent('Incident 2 · Flag recorded');
  expect(screen.getByText('650 kcal')).toBeInTheDocument();
  selectChange(/Incident 1 · Recipe withheld/);
  expect(screen.getByText('600 kcal')).toBeInTheDocument();
  expect(screen.queryByText('650 kcal')).not.toBeInTheDocument();
  expect(screen.getByText('Recorded WITHHELD findings.')).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Flagger · nutrition/));
  expect(screen.getByText('Recorded composition reference.')).toBeVisible();
  expect(screen.getByText('Reconcile the grams per serving.')).toBeVisible();
  expect(screen.getByText('quantity')).toBeVisible();
});

it('compares only a paired saved correction and preserves missing values and ingredient quantities', () => {
  render(<MealReviewTimeline history={history} legacyHistoryUnknown={false} />);
  selectChange(/Incident 1 · Recipe corrected/);
  const comparison = screen.getByRole('table', { name: 'Recorded correction comparison' });
  expect(within(comparison).getByText('600 kcal')).toBeInTheDocument();
  expect(within(comparison).getByText('650 kcal')).toBeInTheDocument();
  expect(within(comparison).getAllByText('Not recorded')).toHaveLength(2);
  fireEvent.click(screen.getByText('Recorded ingredients and serving'));
  expect(screen.getByText('Squash · 325 g')).toBeVisible();
  expect(screen.getByText('Squash · 300 g')).toBeVisible();
});

it('does not compare a correction with an unrelated older snapshot or another serving id', () => {
  const unpaired = {
    ...history[0],
    decisions: [
      decision('before', 'CORRECTION_BEFORE', 600),
      decision('unrelated', 'CONFIRMED', 600),
      decision('after', 'CORRECTED', 650),
    ],
  };
  const view = render(<MealReviewTimeline history={[unpaired]} legacyHistoryUnknown={false} />);
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText('600 kcal')).not.toBeInTheDocument();
  view.rerender(
    <MealReviewTimeline
      history={[
        {
          ...unpaired,
          decisions: [
            {
              ...decision('before-other', 'CORRECTION_BEFORE', 600),
              snapshot: { meals: [{ ...meal, id: 'other-serving' }] },
            },
            decision('after-current', 'CORRECTED', 650),
          ],
        },
      ]}
      legacyHistoryUnknown={false}
    />
  );
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
});

it('keeps prior incident notes accessible when active concerns are already shown in the review form', () => {
  render(<MealReviewTimeline history={history} legacyHistoryUnknown={true} displayedReportIds={['flag-2']} />);
  expect(screen.queryByRole('region', { name: 'Incident flag notes' })).not.toBeInTheDocument();
  expect(screen.getByText(/Prior incident counts/)).toBeInTheDocument();
  selectChange(/Incident 1 · Recipe withheld/);
  expect(screen.getByRole('region', { name: 'Incident flag notes' })).toBeInTheDocument();
});

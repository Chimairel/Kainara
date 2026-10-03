import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SwapImpactDetails from './SwapImpactDetails';

describe('swap nutrition and shopping impact', () => {
  it('explains macro direction and remaining gaps even when calories match', () => {
    render(
      <SwapImpactDetails
        analysis={{
          before: { calories: 2000, proteinG: 111, carbsG: 194, fatG: 82 },
          after: { calories: 2000, proteinG: 97, carbsG: 285, fatG: 47 },
          target: {
            calories: 2000,
            proteinG: 100,
            carbsG: 250,
            fatG: 66,
            explanation: 'Fixture',
            basis: 'GENERAL_ADULT_ESTIMATE',
          },
          completeDay: true,
          warnings: ['Fat is below the daily planning estimate.'],
          nutritionMatch: 'GAPS_REMAIN',
          macroChanges: [
            { nutrient: 'proteinG', direction: 'CLOSER', status: 'WITHIN_ESTIMATE' },
            { nutrient: 'carbsG', direction: 'CLOSER', status: 'WITHIN_ESTIMATE' },
            { nutrient: 'fatG', direction: 'FURTHER', status: 'BELOW' },
          ],
        }}
        additions={[]}
        removals={[]}
      />
    );
    expect(screen.getByText('Daily macro gaps remain')).toBeInTheDocument();
    expect(screen.getByText('Protein: closer to target · within the planning range')).toBeInTheDocument();
    expect(screen.getByText('Fat: further from target · below target')).toBeInTheDocument();
    expect(screen.getByText('No changes to remaining groceries.')).toBeInTheDocument();
  });
  it('shows all four before/after/target values and actual rice additions and removals', () => {
    render(
      <SwapImpactDetails
        analysis={{
          before: { calories: 2000, proteinG: 30, carbsG: 200, fatG: 120 },
          after: { calories: 2000, proteinG: 105, carbsG: 250, fatG: 66 },
          target: {
            calories: 2000,
            proteinG: 120,
            carbsG: 240,
            fatG: 60,
            explanation: 'Fixture estimates',
            basis: 'MUSCLE_BUILDING_ESTIMATE',
          },
          completeDay: true,
          warnings: ['Protein is below the daily planning estimate.'],
        }}
        additions={[
          { ingredientName: 'Rice, well-milled, boiled', unit: 'g', additionalQuantity: 75, remainingQuantity: 225 },
        ]}
        removals={[{ ingredientName: 'Pork', unit: 'g', removableQuantity: 100 }]}
      />
    );
    const table = screen.getByRole('table');
    expect(within(table).getAllByText('2000 kcal')).toHaveLength(3);
    expect(within(table).getByText('105 g')).toBeInTheDocument();
    expect(within(table).getAllByText('120 g')).toHaveLength(2);
    expect(screen.getByText(/Rice, well-milled, boiled: \+75 g/)).toBeInTheDocument();
    expect(screen.getByText(/225 g left to buy/)).toBeInTheDocument();
    expect(screen.getByText('Pork: −100 g')).toBeInTheDocument();
    expect(screen.getByText('Protein is below the daily planning estimate.')).toBeInTheDocument();
  });
  it('does not invent unknown quantities or claim an incomplete day meets its full target', () => {
    render(
      <SwapImpactDetails
        analysis={{
          before: { calories: 500, proteinG: 20, carbsG: 40, fatG: 25 },
          after: { calories: 500, proteinG: 20, carbsG: 40, fatG: 25 },
          target: {
            calories: 2000,
            proteinG: 100,
            carbsG: 250,
            fatG: 67,
            explanation: 'Fixture',
            basis: 'GENERAL_ADULT_ESTIMATE',
          },
          completeDay: false,
          warnings: [],
        }}
        additions={[{ ingredientName: 'Spice mix', unit: null, additionalQuantity: null, remainingQuantity: null }]}
        removals={[]}
      />
    );
    expect(screen.getByText(/Spice mix: \+quantity needs checking/)).toBeInTheDocument();
    expect(screen.getByText(/This day has missing or unavailable meals/)).toBeInTheDocument();
  });
});

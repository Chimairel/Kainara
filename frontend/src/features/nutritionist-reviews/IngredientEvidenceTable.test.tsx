import { render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import IngredientEvidenceTable from './IngredientEvidenceTable';

it('separates recorded ingredient amounts and units without inventing missing evidence', () => {
  render(
    <IngredientEvidenceTable
      ingredients={[
        { name: 'Oil', quantity: 1, unit: 'tbsp', source: 'SOURCE_RECIPE' },
        { name: 'Squash', quantity: null, unit: null, source: 'UNKNOWN' },
      ]}
    />
  );
  const table = screen.getByRole('table', { name: 'Meal ingredients' });
  const cells = within(table).getAllByRole('cell');
  expect(cells.slice(0, 4).map((cell) => cell.textContent)).toEqual(['Oil', '1', 'tbsp', 'Source recipe']);
  expect(cells.slice(4).map((cell) => cell.textContent)).toEqual([
    'Squash',
    'Not recorded',
    'Not recorded',
    'Not recorded',
  ]);
  expect(within(table).queryByRole('textbox')).not.toBeInTheDocument();
  expect(within(table).queryByRole('spinbutton')).not.toBeInTheDocument();
});

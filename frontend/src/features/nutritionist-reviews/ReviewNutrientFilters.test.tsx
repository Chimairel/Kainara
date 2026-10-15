import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ReviewNutrientFilters, { parseFilterDraft } from './ReviewNutrientFilters';

it('keeps a recorded zero, validates bounds, and does not invent defaults or medical limits', () => {
  expect(parseFilterDraft({})).toEqual({});
  expect(parseFilterDraft({ sugarG: { max: '0' }, sodiumMg: { min: ' 10 ', max: '' } })).toEqual({ sugarG: { max: 0 }, sodiumMg: { min: 10 } });
  for (const max of ['-1', 'Infinity', 'NaN', '1000001']) expect(parseFilterDraft({ sugarG: { max } })).toBeNull();
  expect(parseFilterDraft({ sugarG: { min: '37', max: '36' } })).toBeNull();
});
it('adds and removes only the requested nutrients with explicit comparisons and units', () => {
  const change = vi.fn();
  const { rerender } = render(<ReviewNutrientFilters draft={{ sugarG: { min: '37', max: '36' } }} onChange={change} busy={false} />);
  expect(screen.getByText(/one meal, including rice/)).toBeInTheDocument();
  expect(screen.getByText(/Use nonnegative amounts/)).toBeVisible();
  rerender(<ReviewNutrientFilters draft={{ sodiumMg: { max: '500' } }} onChange={change} busy={false} />);
  expect(screen.queryByLabelText('Sugar maximum (g)')).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Sodium maximum (mg)'), { target: { value: '200' } });
  expect(change).toHaveBeenLastCalledWith({ sodiumMg: { max: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove Sodium filter' }));
  expect(change).toHaveBeenLastCalledWith({});
});
it('supports exact decimals, zero, combined ranges and blocks incomplete rows', () => {
  expect(parseFilterDraft({ proteinG: { mode: 'exact', min: '35.7' }, fatG: { max: '14.6' }, sugarG: { mode: 'exact', min: '0' } }))
    .toEqual({ proteinG: { min: 35.7, max: 35.7 }, fatG: { max: 14.6 }, sugarG: { min: 0, max: 0 } });
  expect(parseFilterDraft({ sodiumMg: { mode: 'max', max: '' } })).toBeNull();
  expect(parseFilterDraft({ sodiumMg: { mode: 'between', min: '200' } })).toBeNull();
});

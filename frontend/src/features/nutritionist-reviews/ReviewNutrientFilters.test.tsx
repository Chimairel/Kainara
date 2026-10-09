import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ReviewNutrientFilters, { parseFilterDraft } from './ReviewNutrientFilters';

it('keeps a recorded zero, validates bounds, and does not invent defaults or medical limits', () => {
  expect(parseFilterDraft({})).toEqual({});
  expect(parseFilterDraft({ sugarG: { max: '0' }, sodiumMg: { min: ' 10 ', max: '' } })).toEqual({ sugarG: { max: 0 }, sodiumMg: { min: 10 } });
  for (const max of ['-1', 'Infinity', 'NaN', '1000001']) expect(parseFilterDraft({ sugarG: { max } })).toBeNull();
  expect(parseFilterDraft({ sugarG: { min: '37', max: '36' } })).toBeNull();
});
it('renders fixed-unit controls, explains side totals and unknown exclusion, and blocks invalid submissions', () => {
  const apply = vi.fn(), change = vi.fn();
  const { rerender } = render(<ReviewNutrientFilters draft={{ sugarG: { min: '37', max: '36' } }} onChange={change} apply={apply} busy={false} />);
  expect(screen.getByText(/one serving including rice/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Apply filters' })).toBeDisabled();
  rerender(<ReviewNutrientFilters draft={{ sugarG: { max: '36' } }} onChange={change} apply={apply} busy={false} />);
  fireEvent.change(screen.getByLabelText('Sodium maximum (mg)'), { target: { value: '200' } });
  expect(change).toHaveBeenCalledWith({ sugarG: { max: '36' }, sodiumMg: { max: '200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' })); expect(apply).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Clear limits' })); expect(change).toHaveBeenLastCalledWith({});
});

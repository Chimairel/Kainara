import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import PatientNutritionLimits from './PatientNutritionLimits';
const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: api }));
beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: { data: { limits: [], defaultRules: [], profileRevision: 4 } } });
});
it('submits an attributed patient scope and preserves its draft after a rejected request', async () => {
  api.post.mockRejectedValueOnce(new Error('stale claim')).mockResolvedValueOnce({ data: {} });
  render(<PatientNutritionLimits mealId="claimed-meal" conditions={['DIABETES']} />);
  await screen.findByText('No patient-specific limits recorded.');
  fireEvent.click(screen.getByText('Record a new limit'));
  for (const [name, value] of [
    ['Limit (g)', '50'], ['Effective from (device time)', '2026-10-17T08:00'],
    ['Source title', 'Reviewed care plan'], ['HTTPS source URL', 'https://example.org/care'],
    ['Clinical rationale', 'Individual documented nutrition guidance.'],
  ]) fireEvent.change(screen.getByLabelText(name), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Save patient limit' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Clinical rationale')).toHaveValue('Individual documented nutrition guidance.');
  expect(api.post).toHaveBeenCalledWith('/nutritionist/patient-nutrition/claimed-meal/limits', expect.objectContaining({
    expectedProfileRevision: 4, condition: 'DIABETES', nutrient: 'CARBOHYDRATE_G', basis: 'PER_SERVING', threshold: 50, replacesRuleId: null,
  }));
  fireEvent.click(screen.getByRole('button', { name: 'Save patient limit' }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('acknowledge refreshed guidance'));
});
it('reports a failed case load without allowing an unclaimed mutation', async () => {
  api.get.mockRejectedValueOnce(new Error('not claimed'));
  render(<PatientNutritionLimits mealId="other-case" conditions={['DIABETES']} />);
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Save patient limit' })).toBeNull();
  expect(api.post).not.toHaveBeenCalled();
});

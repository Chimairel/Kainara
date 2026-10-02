import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RecipeDerivationForm from './RecipeDerivationForm';
import type { LibraryMeal } from './useNutritionistLibrary';
const api = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: api }));
const meal = {
  id: 'original',
  mealName: 'Tomato dish',
  mealType: 'BREAKFAST',
  safetyEvidenceRevision: 2,
  description: 'Tomato preparation\n\nPreparation instructions: Cook the tomato until tender.',
  riceRole: 'PAIR_WITH_RICE',
  ingredients: [
    {
      foodItemId: 'tomato',
      ingredientName: 'Tomato',
      quantity: 300,
      unit: 'g',
      foodItem: { calories: 100, proteinG: 10, carbsG: 10, fatG: 2 },
    },
  ],
} as LibraryMeal;
describe('immutable recipe draft editor', () => {
  beforeEach(() => vi.clearAllMocks());
  it('recalculates measured grams and submits one independent draft on repeated clicks', async () => {
    let resolve!: (value: unknown) => void;
    api.post.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    const created = vi.fn();
    render(<RecipeDerivationForm meal={meal} onCreated={created} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create recipe draft' }));
    expect(screen.getByText(/300 kcal/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Grams for Tomato' }), { target: { value: '400' } });
    expect(screen.getByText(/400 kcal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Reason for changes'), {
      target: { value: 'Increase the measured tomato serving.' },
    });
    const submit = screen.getByRole('button', { name: 'Submit for independent review' });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(
      '/nutritionist/library/original/derive',
      expect.objectContaining({
        expectedRevision: 2,
        ingredients: [{ foodItemId: 'tomato', grams: 400 }],
        riceMinHalfCups: 1,
        riceMaxHalfCups: 3,
      })
    );
    resolve({ data: { data: { id: 'new-draft' } } });
    await waitFor(() => expect(created).toHaveBeenCalledWith('new-draft'));
  });
  it('requires measuring legacy non-gram portions instead of treating cups as grams', () => {
    render(
      <RecipeDerivationForm
        meal={{ ...meal, ingredients: [{ ...meal.ingredients![0], unit: 'cup', quantity: 1 }] }}
        onCreated={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Create recipe draft' }));
    expect(screen.getByRole('spinbutton', { name: 'Grams for Tomato' })).toHaveValue(0);
    expect(screen.getByRole('button', { name: 'Submit for independent review' })).toBeDisabled();
  });
});

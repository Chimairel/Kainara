import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RecipeLibraryCard from './RecipeLibraryCard';

vi.mock('@/components/user/MealImage', () => ({
  default: ({ mealName }: { mealName: string }) => <div aria-label={`Image of ${mealName}`} />,
}));

const recipe = {
  name: 'Tinola Recipe',
  mealType: 'LUNCH',
  image: null,
  description: 'Chicken soup',
  calories: 320,
  proteinG: 24,
  carbsG: 18,
  fatG: 12,
};

describe('shared recipe library card', () => {
  it('keeps RND review status and actions supplied by the RND page', () => {
    const open = vi.fn();
    render(
      <RecipeLibraryCard
        {...recipe}
        variant="nutritionist"
        badges={<span>Review pending</span>}
        footer={
          <button type="button" onClick={open}>
            View
          </button>
        }
      />
    );

    expect(screen.getByText('Review pending')).toBeInTheDocument();
    expect(screen.getByText('Tinola')).toBeInTheDocument();
    expect(screen.getByLabelText('Image of Tinola Recipe')).toBeInTheDocument();
    expect(screen.queryByText('Recipe verified')).not.toBeInTheDocument();
    expect(screen.getByText(/320 kcal/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(open).toHaveBeenCalledOnce();
  });

  it('does not invent nutrient values for a recipe without serving evidence', () => {
    render(
      <RecipeLibraryCard {...recipe} variant="catalogue" calories={null} proteinG={null} carbsG={null} fatG={null} />
    );
    expect(screen.getByText('Serving evidence pending clinical portioning')).toBeInTheDocument();
    expect(screen.queryByText('0 kcal')).not.toBeInTheDocument();
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import VerifiedRecipeCatalog from './VerifiedRecipeCatalog';

const get = vi.hoisted(() => vi.fn());
vi.mock('@/lib/axios', () => ({ default: { get } }));
vi.mock('@/components/user/MealImage', () => ({
  default: ({ mealName }: { mealName: string }) => <div aria-label={`Image of ${mealName}`} />,
}));

describe('verified recipe catalogue', () => {
  beforeEach(() => get.mockReset());

  it('shows the complete verified count separately from planning readiness', async () => {
    get.mockResolvedValue({ data: { data: {
      total: 1960, page: 1, pageCount: 82, restrictedProfile: false,
      items: [{ id: 'raw:1', name: 'Chicken Tinola', description: 'Published dish',
        mealTypes: ['LUNCH', 'DINNER'], calories: 500, proteinG: 30, carbsG: 20, fatG: 10,
        sourceName: 'PANLASANG_PINOY', sourceUrl: 'https://panlasangpinoy.com/tinola/',
        imageUrl: null, planningReady: false }],
    } } });
    render(<VerifiedRecipeCatalog search="" mealType="All" />);
    await waitFor(() => expect(screen.getByText('Verified recipe catalogue · 1960')).toBeInTheDocument());
    expect(screen.getByText('Chicken Tinola')).toBeInTheDocument();
    expect(screen.getByText('Serving evidence pending')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 82')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/user/meals/verified-recipes', { params: { page: 1 } });
  });

  it('does not present unrestricted base recipes to a restricted profile', async () => {
    get.mockResolvedValue({ data: { data: {
      total: 0, page: 1, pageCount: 0, restrictedProfile: true, items: [],
    } } });
    render(<VerifiedRecipeCatalog search="" mealType="All" />);
    await waitFor(() => expect(get).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByText(/General base recipes are shown here only/)).toBeInTheDocument());
    expect(screen.queryByText('Recipe verified')).not.toBeInTheDocument();
  });
});

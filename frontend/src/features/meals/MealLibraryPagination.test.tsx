import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import MealLibraryPanel from './MealLibraryPanel';
import type { useMealsWorkspace } from './useMealsWorkspace';

vi.mock('./useRecipeCatalog', () => ({
  useRecipeCatalog: () => ({
    data: { items: [], restrictedProfile: true },
    summary: { restrictedProfile: true },
    loading: false,
    error: null,
    retry: vi.fn(),
  }),
}));
function workspace() {
  const meals = Array.from({ length: 6 }, (_, index) => ({
    id: `library-${index}`,
    mealName: `Compatible recipe ${index}`,
    mealType: 'LUNCH',
    calories: 400,
    proteinG: 20,
    carbsG: 50,
    fatG: 10,
  }));
  return {
    ownerId: 'member-pagination-fixture',
    activeTab: 'library',
    meals: [],
    libraryMeals: meals,
    librarySearch: '',
    libraryMealType: 'All',
    libraryRiceRole: 'All',
    setLibrarySearch: vi.fn(),
    setLibraryMealType: vi.fn(),
    setLibraryRiceRole: vi.fn(),
    handleLibrarySearchSubmit: vi.fn(),
    isLibraryLoading: false,
    libraryError: null,
    libraryNextCursor: 'next-batch',
    loadMoreLibrary: vi.fn().mockResolvedValue(undefined),
    retryLibrary: vi.fn(),
  } as unknown as ReturnType<typeof useMealsWorkspace>;
}
it('keeps the current compatible page until the next cursor batch arrives', async () => {
  const state = workspace();
  const { rerender } = render(<MealLibraryPanel workspace={state} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  expect(state.loadMoreLibrary).toHaveBeenCalledOnce();
  expect(screen.getByRole('heading', { name: 'Compatible recipe 0' })).toBeInTheDocument();
  rerender(
    <MealLibraryPanel
      workspace={{
        ...state,
        libraryNextCursor: null,
        libraryMeals: [
          ...state.libraryMeals,
          { ...state.libraryMeals[0], id: 'library-next', mealName: 'Next compatible meal' },
        ],
      }}
    />
  );
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Next compatible meal' })).toBeInTheDocument());
  expect(screen.queryByRole('heading', { name: 'Compatible recipe 0' })).not.toBeInTheDocument();
});
it('does not advance to an empty page when cursor loading fails', () => {
  const state = workspace();
  const { rerender } = render(<MealLibraryPanel workspace={state} />);
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));
  rerender(<MealLibraryPanel workspace={{ ...state, libraryError: 'Could not load compatible recipes' }} />);
  expect(screen.getByRole('heading', { name: 'Compatible recipe 0' })).toBeInTheDocument();
  expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
});

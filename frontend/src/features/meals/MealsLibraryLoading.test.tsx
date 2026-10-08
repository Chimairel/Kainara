import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import MealsWorkspace from './MealsWorkspace';
import { useState } from 'react';

const fixture = vi.hoisted(() => ({
  get: vi.fn(),
  push: vi.fn(),
  saved: () => {},
  workspace: {} as Record<string, unknown>,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: fixture.push }) }));
vi.mock('@/features/dashboard/useOutsideMealLog', () => ({
  useOutsideMealLog: (saved: () => void) => {
    fixture.saved = saved;
    const [isOpen, setIsOpen] = useState(false);
    return { isOpen, setIsOpen };
  },
}));
vi.mock('@/features/dashboard/OutsideMealModal', () => ({
  OutsideMealModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? (
      <div role="dialog" aria-label="Food log">
        <button onClick={() => fixture.saved()}>Save fixture food</button>
      </div>
    ) : null,
}));
vi.mock('@/lib/axios', () => ({ default: { get: fixture.get } }));
vi.mock('./useMealsPage', () => ({
  useMealsPage: () => ({
    activeTab: 'library',
    setActiveTab: vi.fn(),
    isLoading: false,
    cycles: null,
    displayedMealCount: 15,
    historyTotalCount: 0,
    generationStatus: {},
    isReportPending: false,
    error: null,
    workspace: fixture.workspace,
  }),
}));
vi.mock('./UnavailableMealsNotice', () => ({ default: () => null }));
vi.mock('./MealsGenerationNotice', () => ({ default: () => null }));
vi.mock('./MealsDateNavigation', () => ({ default: () => null }));
vi.mock('./MealsPlanSection', () => ({ default: () => null }));
vi.mock('./MealsHistorySection', () => ({ default: () => null }));
vi.mock('./MealsWorkspaceModals', () => ({ MealsWorkspaceModals: () => null }));
vi.mock('@/components/user/MealImage', () => ({ default: () => null }));

beforeEach(() => {
  fixture.get.mockReset();
  fixture.push.mockReset();
  fixture.workspace = {
    ownerId: 'library-fixture',
    activeTab: 'library',
    librarySearch: '',
    libraryMealType: 'All',
    libraryRiceRole: 'All',
    setLibrarySearch: vi.fn(),
    setLibraryMealType: vi.fn(),
    setLibraryRiceRole: vi.fn(),
    handleLibrarySearchSubmit: vi.fn(),
    libraryMeals: [],
    libraryTotalCount: 0,
    isLibraryLoading: false,
    libraryNextCursor: null,
    libraryError: null,
    meals: [
      {
        id: 'scheduled-slot',
        status: 'APPROVED',
        mealName: 'Scheduled fixture dish',
        mealType: 'LUNCH',
        calories: 400,
        proteinG: 20,
        carbsG: 40,
        fatG: 12,
        libraryMealId: null,
      },
    ],
    refreshHistory: vi.fn(),
    historySearch: '',
    historySource: 'All',
    historyStatus: 'All',
  };
});

it('opens the shared food logger, refreshes saved history, and routes the header action to groceries', async () => {
  fixture.get.mockResolvedValue(catalogue());
  fixture.workspace = { ...fixture.workspace, user: { reportAcknowledged: true } };
  render(<MealsWorkspace />);
  fireEvent.click(screen.getByRole('button', { name: 'Log food or snack' }));
  expect(screen.getByRole('dialog', { name: 'Food log' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save fixture food' }));
  expect(fixture.workspace.refreshHistory).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', { name: 'Groceries' }));
  expect(fixture.push).toHaveBeenCalledWith('/grocery');
  expect(screen.queryByText(/swaps left in your current plan cycle/)).not.toBeInTheDocument();
});

it('keeps the food-log action and modal unavailable before report acknowledgement', () => {
  fixture.get.mockResolvedValue(catalogue());
  fixture.workspace = { ...fixture.workspace, user: { reportAcknowledged: false } };
  render(<MealsWorkspace />);
  expect(screen.queryByRole('button', { name: 'Log food or snack' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
const catalogue = (restrictedProfile = false) => ({
  data: {
    data: {
      restrictedProfile,
      total: restrictedProfile ? 0 : 1960,
      page: 1,
      pageCount: restrictedProfile ? 0 : 327,
      items: restrictedProfile
        ? []
        : [
            {
              id: 'catalogue-recipe',
              name: 'Verified fixture dish',
              mealTypes: ['LUNCH'],
              planningReady: true,
              calories: 450,
              proteinG: 25,
              carbsG: 40,
              fatG: 15,
            },
          ],
    },
  },
});
const libraryTab = () =>
  within(screen.getByRole('navigation', { name: 'Meal workspace sections' })).getByRole('button', { name: /Library/ });

it('shows a skeleton instead of temporary planned recipes, then displays the catalogue total in the tab', async () => {
  let resolve!: (value: ReturnType<typeof catalogue>) => void;
  fixture.get.mockImplementation(
    () =>
      new Promise((done) => {
        resolve = done;
      })
  );
  const { rerender } = render(<MealsWorkspace />);
  expect(screen.getByLabelText('Loading meal library grid')).toBeInTheDocument();
  expect(screen.queryByText('Scheduled for you')).not.toBeInTheDocument();
  expect(libraryTab()).toHaveTextContent('…');
  await waitFor(() => expect(fixture.get).toHaveBeenCalledOnce());
  await act(async () => resolve(catalogue()));
  expect(screen.getByText('Verified fixture dish')).toBeInTheDocument();
  expect(screen.queryByText('Scheduled fixture dish')).not.toBeInTheDocument();
  expect(screen.queryByText('Serving data recorded')).not.toBeInTheDocument();
  expect(libraryTab()).toHaveTextContent('1960');
  fixture.workspace = { ...fixture.workspace, librarySearch: 'another filter' };
  rerender(<MealsWorkspace />);
  expect(libraryTab()).toHaveTextContent('…');
  expect(screen.queryByText('Verified fixture dish')).not.toBeInTheDocument();
});

it('does not substitute planned recipes on catalogue failure and recovers through Retry', async () => {
  fixture.get.mockRejectedValueOnce(new Error('Catalogue unavailable')).mockResolvedValueOnce(catalogue());
  render(<MealsWorkspace />);
  await waitFor(() => expect(screen.getByText('Could not load recipes.')).toBeInTheDocument());
  expect(screen.queryByText('Scheduled fixture dish')).not.toBeInTheDocument();
  expect(libraryTab()).toHaveTextContent('…');
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(libraryTab()).toHaveTextContent('1960'));
});

it('waits for restricted-profile compatibility results and counts unique planned and compatible recipes', async () => {
  fixture.get.mockResolvedValue(catalogue(true));
  fixture.workspace = { ...fixture.workspace, isLibraryLoading: true, libraryTotalCount: null };
  const { rerender } = render(<MealsWorkspace />);
  await waitFor(() => expect(fixture.get).toHaveBeenCalledOnce());
  expect(screen.getByLabelText('Loading meal library grid')).toBeInTheDocument();
  expect(screen.queryByText('Scheduled fixture dish')).not.toBeInTheDocument();
  fixture.workspace = {
    ...fixture.workspace,
    isLibraryLoading: false,
    libraryTotalCount: 1,
    libraryMeals: [
      {
        id: 'compatible-recipe',
        mealName: 'Compatible fixture dish',
        mealType: 'LUNCH',
        calories: 450,
        proteinG: 25,
        carbsG: 40,
        fatG: 15,
        reuseBasis: 'PROFILE_MATCHED_APPROVAL',
      },
    ],
  };
  rerender(<MealsWorkspace />);
  await waitFor(() => expect(screen.getByText('Compatible fixture dish')).toBeInTheDocument());
  expect(screen.getByText('Scheduled fixture dish')).toBeInTheDocument();
  expect(screen.queryByText('Verified fixture dish')).not.toBeInTheDocument();
  expect(libraryTab()).toHaveTextContent('2');
});

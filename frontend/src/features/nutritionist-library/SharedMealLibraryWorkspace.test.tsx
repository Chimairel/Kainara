import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SharedMealLibraryWorkspace from './SharedMealLibraryWorkspace';

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  hook: vi.fn(),
  refresh: vi.fn(),
  loading: vi.fn(() => 'notice'),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('sonner', () => ({ toast: mocks }));
vi.mock('./LibrarySafetyReview', () => ({ default: () => <div>Clinical evidence editor</div> }));
vi.mock('./RecipeDerivationForm', () => ({ default: () => <div>Recipe derivation editor</div> }));
vi.mock('./MealApprovalsPanel', () => ({ MealApprovalsPanel: () => <div>Private case approvals</div> }));
vi.mock('./useNutritionistLibrary', () => ({ AVAILABLE_CONDITIONS: [], useNutritionistLibrary: mocks.hook }));

const meal = {
  id: 'meal-1',
  mealName: 'Test lunch',
  mealType: 'LUNCH',
  calories: 500,
  proteinG: 30,
  carbsG: 60,
  fatG: 15,
  status: 'APPROVED',
  ingredients: [],
  usageCount: 0,
  flags: [],
  baseVerification: 'VERIFIED',
};
const flagged = {
  ...meal,
  status: 'FLAGGED',
  flags: [
    {
      id: 'flag-1',
      status: 'PENDING',
      reason: 'Ingredient evidence needs review.',
      flaggedByNutritionist: null,
      flaggedByAdminUser: { name: 'Test admin' },
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.hook.mockReturnValue({
    meals: [meal],
    totalCount: 1,
    page: 1,
    setPage: vi.fn(),
    totalPages: 1,
    isLoading: false,
    fetchError: null,
    coverage: null,
    searchVal: '',
    setSearchVal: vi.fn(),
    mealType: 'All',
    setMealType: vi.fn(),
    conditionTag: 'All',
    setConditionTag: vi.fn(),
    verifiedByMe: false,
    setVerifiedByMe: vi.fn(),
    adminDraftsOnly: false,
    setAdminDraftsOnly: vi.fn(),
    status: 'ALL',
    setStatus: vi.fn(),
    fetchLibrary: mocks.refresh,
  });
  mocks.get.mockResolvedValue({ data: { success: true, data: meal } });
  mocks.post.mockResolvedValue({ data: { success: true } });
});

async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  await screen.findByRole('region', { name: 'Meal details' });
}

describe('shared library permissions and feedback', () => {
  it('admin browses and flags the same recipe with its own API and sees the recorded admin actor', async () => {
    render(<SharedMealLibraryWorkspace role="admin" />);
    expect(mocks.hook).toHaveBeenCalledWith(false, 'admin');
    expect(screen.queryByLabelText('Show only meals verified by me')).not.toBeInTheDocument();
    await open();
    expect(mocks.get).toHaveBeenCalledWith('/admin/library/meal-1');
    expect(screen.queryByText('Clinical evidence editor')).not.toBeInTheDocument();
    expect(screen.queryByText('Recipe derivation editor')).not.toBeInTheDocument();
    expect(screen.queryByText('Private case approvals')).not.toBeInTheDocument();
    mocks.get.mockResolvedValue({ data: { success: true, data: flagged } });
    const button = screen.getByRole('button', { name: 'Flag entire meal' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Reason for flagging the meal'), {
      target: { value: 'Ingredient evidence needs review.' },
    });
    fireEvent.click(button);
    await screen.findByText('Flagged by Test admin (admin): Ingredient evidence needs review.');
    expect(mocks.post).toHaveBeenCalledWith('/admin/library/meal-1/flag', {
      reason: 'Ingredient evidence needs review.',
    });
    expect(mocks.success).toHaveBeenCalledWith('Meal flagged for nutritionist review', { id: 'notice' });
    expect(screen.queryByRole('button', { name: 'Release meal flag' })).not.toBeInTheDocument();
  });

  it('nutritionist keeps existing clinical tools and can review an admin flag', async () => {
    mocks.get.mockResolvedValue({ data: { success: true, data: flagged } });
    render(<SharedMealLibraryWorkspace />);
    await open();
    expect(mocks.get).toHaveBeenCalledWith('/nutritionist/library/meal-1');
    expect(screen.getByText('Clinical evidence editor')).toBeInTheDocument();
    expect(screen.getByText('Recipe derivation editor')).toBeInTheDocument();
    expect(screen.getByText('Private case approvals')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Release meal flag' })).toBeDisabled();
  });

  it('keeps the flag reason when saving fails and gives a Sonner error', async () => {
    mocks.post.mockRejectedValue({ response: { data: { error: 'Meal status changed. Reload and try again.' } } });
    render(<SharedMealLibraryWorkspace role="admin" />);
    await open();
    fireEvent.change(screen.getByLabelText('Reason for flagging the meal'), {
      target: { value: 'Ingredient evidence needs review.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag entire meal' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalled());
    expect(screen.getByLabelText('Reason for flagging the meal')).toHaveValue('Ingredient evidence needs review.');
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it('distinguishes a successful flag from a later detail refresh failure', async () => {
    render(<SharedMealLibraryWorkspace role="admin" />);
    await open();
    mocks.get.mockRejectedValue(new Error('Network unavailable'));
    fireEvent.change(screen.getByLabelText('Reason for flagging the meal'), {
      target: { value: 'Ingredient evidence needs review.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag entire meal' }));
    await waitFor(() =>
      expect(mocks.warning).toHaveBeenCalledWith('Meal flag saved. Reload to see the updated library.', {
        id: 'notice',
      })
    );
    expect(mocks.error).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Flag entire meal' })).not.toBeInTheDocument();
  });
});

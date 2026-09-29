import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import type { GroceryItem, GroceryWorkspace } from '@/features/grocery/current-grocery';
import GroceryListPage from './page';

const authState = vi.hoisted(() => ({ userId: 'grocery-user' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: authState.userId } }) }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }));

const rice: GroceryItem = {
  id: 'rice', ingredientName: 'Rice', category: 'Grains', isChecked: false,
  quantity: 100, purchasedQuantity: 0, unit: 'g', sourceMealCount: 1, isPantryStaple: false,
};
const salt: GroceryItem = {
  id: 'salt', ingredientName: 'Salt', category: 'Condiments', isChecked: false,
  quantity: null, purchasedQuantity: 0, unit: null, sourceMealCount: 1, isPantryStaple: false,
};
const workspace: GroceryWorkspace = {
  current: {
    scope: 'CURRENT',
    cycle: {
      id: 'cycle', startDate: '', endDate: '', status: 'READY_TO_SHOP',
      deadlineOutcome: 'COMPLETE', incompleteAcknowledgedAt: null, shoppingStartedAt: null,
    },
    groceryList: { id: 'list', weekLabel: 'Current', generatedAt: '', groceryItems: [rice, salt] },
    coverage: { clearedSlotCount: 3, expectedSlotCount: 3, unresolvedSlotCount: 0 },
    actionability: {
      canCheckItems: true, canExportPdf: true, isFinal: true, isIncomplete: false,
      quantitiesMayIncrease: false, requiresIncompleteAcknowledgment: false, message: 'Ready for shopping.',
    },
  },
  upcoming: null,
};
const get = vi.mocked(api.get);
const patch = vi.mocked(api.patch);

beforeEach(() => {
  authState.userId = 'grocery-user';
  clearSessionResourceCache();
  get.mockReset();
  patch.mockReset();
  get.mockResolvedValue({ data: { success: true, data: workspace } });
});

describe('grocery checklist', () => {
  it('checks a measured item without reloading the workspace', async () => {
    patch.mockResolvedValue({ data: { success: true, data: { ...rice, isChecked: true, purchasedQuantity: 100 } } });
    render(<GroceryListPage />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Mark as bought: Rice' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mark as not bought: Rice' })).not.toBeDisabled());
    expect(patch).toHaveBeenCalledWith('/user/grocery/items/rice/toggle');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('allows a provisional checklist item to be checked before all meal slots clear', async () => {
    get.mockResolvedValueOnce({ data: { success: true, data: {
      ...workspace,
      current: {
        ...workspace.current,
        cycle: { ...workspace.current!.cycle, status: 'UNDER_REVIEW' },
        coverage: { clearedSlotCount: 1, expectedSlotCount: 3, unresolvedSlotCount: 2 },
        actionability: {
          ...workspace.current!.actionability,
          canExportPdf: false,
          isFinal: false,
          quantitiesMayIncrease: true,
        },
      },
    } } });
    patch.mockResolvedValue({ data: { success: true, data: { ...salt, isChecked: true } } });
    render(<GroceryListPage />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Mark as bought: Salt' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mark as not bought: Salt' })).not.toBeDisabled());
    expect(patch).toHaveBeenCalledWith('/user/grocery/items/salt/toggle');
  });

  it('checks all visible items in one request, including an unmeasured ingredient', async () => {
    patch.mockResolvedValue({
      data: { success: true, data: [
        { ...rice, isChecked: true, purchasedQuantity: 100 },
        { ...salt, isChecked: true, purchasedQuantity: 0 },
      ] },
    });
    render(<GroceryListPage />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Mark all visible items purchased' }));
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Uncheck all visible items' })).not.toBeDisabled());
    expect(patch).toHaveBeenCalledTimes(1);
    expect(patch).toHaveBeenCalledWith('/user/grocery/items/checklist', {
      itemIds: ['rice', 'salt'], checked: true,
    });
  });

  it('restores an item and shows the error when the server rejects a toggle', async () => {
    patch.mockRejectedValue({ response: { data: { error: 'Shopping list changed' } } });
    render(<GroceryListPage />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Mark as bought: Rice' }));
    expect(await screen.findByText('Shopping list changed')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Mark as bought: Rice' })).not.toBeDisabled();
  });

  it('clears the previous account’s grocery rows before the next account loads', async () => {
    const { rerender } = render(<GroceryListPage />);
    expect(await screen.findByRole('checkbox', { name: 'Mark as bought: Rice' })).toBeInTheDocument();
    get.mockImplementationOnce(() => new Promise(() => {}));
    authState.userId = 'another-user';
    rerender(<GroceryListPage />);
    expect(screen.queryByRole('checkbox', { name: 'Mark as bought: Rice' })).not.toBeInTheDocument();
  });
});

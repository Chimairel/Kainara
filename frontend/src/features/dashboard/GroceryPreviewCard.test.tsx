import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { clearSessionResourceCache, readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';
import { GroceryPreviewCard } from './GroceryPreviewCard';
import type { GroceryList, GroceryWorkspace } from '@/features/grocery/current-grocery';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));
const list: GroceryList = {
  id: 'list',
  weekLabel: 'Test cycle',
  generatedAt: '',
  groceryItems: [{
    id: 'rice', ingredientName: 'Rice', category: 'Grains', isChecked: false,
    quantity: 100, unit: 'g', sourceMealCount: 1, isPantryStaple: false,
  }],
};
const get = vi.mocked(api.get);
beforeEach(() => {
  vi.restoreAllMocks();
  clearSessionResourceCache();
  get.mockReset();
});

function ageCache() {
  const now = Date.now();
  vi.spyOn(Date, 'now').mockReturnValue(now + 30_001);
}

function workspace(groceryList: GroceryList | null, unresolvedSlotCount: number): GroceryWorkspace {
  return {
    current: {
      scope: 'CURRENT',
      cycle: {
        id: 'cycle', startDate: '', endDate: '', status: 'ACTIVE', deadlineOutcome: null,
        incompleteAcknowledgedAt: null, shoppingStartedAt: null,
      },
      groceryList,
      coverage: { clearedSlotCount: 18 - unresolvedSlotCount, expectedSlotCount: 18, unresolvedSlotCount },
      actionability: {
        canCheckItems: Boolean(groceryList), canExportPdf: Boolean(groceryList), isFinal: unresolvedSlotCount === 0,
        isIncomplete: unresolvedSlotCount > 0, quantitiesMayIncrease: unresolvedSlotCount > 0,
        requiresIncompleteAcknowledgment: false, message: '',
      },
    },
    upcoming: null,
  };
}

function respond(value: GroceryWorkspace) {
  get.mockResolvedValue({ data: { success: true, data: value } });
}

describe('GroceryPreviewCard', () => {
  it('uses the authoritative current-cycle projection and excludes unresolved ingredients', async () => {
    const value = workspace(null, 3);
    respond(value);
    render(<GroceryPreviewCard ownerId="fixture" onNavigateToGrocery={vi.fn()} />);
    expect(await screen.findByRole('status')).toHaveTextContent('3 meal slots unresolved');
    expect(screen.queryByText('Rice')).not.toBeInTheDocument();
    expect(readSessionResource('fixture', 'user-grocery-workspace')).toEqual(value);
    expect(get).toHaveBeenCalledExactlyOnceWith('/user/grocery/workspace');
  });

  it('keeps a partial approved checklist alongside unresolved-slot warnings', async () => {
    respond(workspace(list, 2));
    render(<GroceryPreviewCard ownerId="fixture" onNavigateToGrocery={vi.fn()} />);
    expect(await screen.findByText('Rice')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 meal slots unresolved');
  });

  it('reuses a recently loaded Grocery page snapshot without another request', () => {
    writeSessionResource('fixture', 'user-grocery-workspace', workspace(list, 0));
    render(<GroceryPreviewCard ownerId="fixture" onNavigateToGrocery={vi.fn()} />);
    expect(screen.getByText('Rice')).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it('renders an older Grocery page snapshot immediately while revalidating in the background', async () => {
    writeSessionResource('fixture', 'user-grocery-workspace', workspace(list, 1));
    ageCache();
    let finish!: (value: unknown) => void;
    get.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    render(<GroceryPreviewCard ownerId="fixture" onNavigateToGrocery={vi.fn()} />);
    expect(screen.getByText('Rice')).toBeInTheDocument();
    expect(screen.queryByText('No approved ingredients available for this cycle.')).not.toBeInTheDocument();
    await act(async () => { finish({ data: { success: true, data: workspace(null, 4) } }); });
    await waitFor(() => expect(screen.queryByText('Rice')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('4 meal slots unresolved');
  });

  it('does not turn a failed revalidation into an empty cached checklist', async () => {
    const cached = workspace(list, 5);
    writeSessionResource('fixture', 'user-grocery-workspace', cached);
    ageCache();
    get.mockResolvedValue({ data: { success: false } });
    render(<GroceryPreviewCard ownerId="fixture" onNavigateToGrocery={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not confirm');
    expect(screen.queryByText('Rice')).not.toBeInTheDocument();
    expect(readSessionResource<GroceryWorkspace>('fixture', 'user-grocery-workspace')).toEqual(cached);
  });

  it('does not leak cached groceries or late responses into another owner', async () => {
    let finish!: (value: unknown) => void;
    get.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const cached = workspace(list, 0);
    writeSessionResource('first', 'user-grocery-workspace', cached);
    ageCache();
    const { rerender } = render(<GroceryPreviewCard ownerId="first" onNavigateToGrocery={vi.fn()} />);
    rerender(<GroceryPreviewCard onNavigateToGrocery={vi.fn()} />);
    expect(screen.queryByText('Rice')).not.toBeInTheDocument();
    await act(async () => { finish({ data: { success: true, data: workspace(null, 3) } }); });
    expect(readSessionResource<GroceryWorkspace>('first', 'user-grocery-workspace')).toEqual(workspace(null, 3));
    expect(readSessionResource(undefined, 'user-grocery-workspace')).toBeNull();
  });
});

import api from '@/lib/axios';

export interface GroceryItem {
  id: string;
  ingredientName: string;
  category: string;
  isChecked: boolean;
  quantity: number | null;
  purchasedQuantity?: number;
  unit: string | null;
  sourceMealCount: number;
  isPantryStaple: boolean;
}

/** Existing pantry marks and checked items both mean the ingredient is already available. */
export function isGroceryItemAvailable(item: Pick<GroceryItem, 'isChecked' | 'isPantryStaple'>): boolean {
  return item.isChecked || item.isPantryStaple;
}

export interface GroceryList {
  id: string;
  weekLabel: string;
  generatedAt: string;
  groceryItems: GroceryItem[];
}

export type GroceryCycleStatus =
  | 'PREPARING'
  | 'UNDER_REVIEW'
  | 'READY_TO_SHOP'
  | 'INCOMPLETE_AT_DEADLINE'
  | 'SHOPPING_STARTED'
  | 'ACTIVE'
  | 'REVALIDATION_REQUIRED'
  | 'COMPLETED'
  | 'SUPERSEDED';

export interface GroceryCycleProjection {
  scope: 'CURRENT' | 'UPCOMING';
  cycle: {
    id: string;
    startDate: string;
    endDate: string;
    status: GroceryCycleStatus;
    deadlineOutcome: 'COMPLETE' | 'INCOMPLETE' | null;
    incompleteAcknowledgedAt: string | null;
    shoppingStartedAt: string | null;
  };
  groceryList: GroceryList | null;
  coverage: {
    clearedSlotCount: number;
    expectedSlotCount: number;
    unresolvedSlotCount: number;
  };
  actionability: {
    canCheckItems: boolean;
    canExportPdf: boolean;
    isFinal: boolean;
    isIncomplete: boolean;
    quantitiesMayIncrease: boolean;
    requiresIncompleteAcknowledgment: boolean;
    message: string;
  };
}

export interface GroceryWorkspace {
  current: GroceryCycleProjection | null;
  upcoming: GroceryCycleProjection | null;
}

export async function fetchGroceryWorkspace(signal?: AbortSignal): Promise<GroceryWorkspace> {
  const response = signal
    ? await api.get<{ success: boolean; data: GroceryWorkspace }>('/user/grocery/workspace', { signal })
    : await api.get<{ success: boolean; data: GroceryWorkspace }>('/user/grocery/workspace');
  if (!response.data?.success || !response.data.data) {
    throw new Error('Could not load the current and next grocery cycles.');
  }
  return response.data.data;
}

export function remainingToBuy(required: number | null, purchased: number): number | null {
  if (required === null) return null;
  return Math.max(0, Math.round((required - purchased) * 1000) / 1000);
}

export function purchaseState(required: number | null, purchased: number) {
  if (!Number.isFinite(purchased) || purchased < 0)
    throw new Error('Purchased quantity must be a finite nonnegative number.');
  const remainingQuantity = remainingToBuy(required, purchased);
  return { purchasedQuantity: purchased, remainingQuantity, isChecked: remainingQuantity === 0 };
}

/** Checkbox shopping records an item as obtained, without asking for an exact purchase amount. */
export function checklistPurchaseState(required: number | null, checked: boolean) {
  return { isChecked: checked, purchasedQuantity: checked ? Math.max(0, required ?? 0) : 0 };
}

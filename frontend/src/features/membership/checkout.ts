export type PaidMembershipTier = 'LIFESTYLE' | 'HEALTH';
export type MembershipPeriod = 'MONTHLY' | 'YEARLY';
export const checkoutSelectionKey = 'kainara:membership-selection';
export const displayPrices = {
  LIFESTYLE: { MONTHLY: 24900, YEARLY: 239000 },
  HEALTH: { MONTHLY: 149900, YEARLY: 1439000 },
};
export interface MembershipCheckout {
  id: string;
  tier: PaidMembershipTier;
  period: MembershipPeriod;
  status: 'CREATING' | 'OPEN' | 'PAID' | 'FAILED';
  mode: 'TEST';
  amountCentavos: number;
  checkoutUrl: string | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
}
export function isCheckoutUrl(value: string) {
  try {
    const url = new URL(value);
    return url.origin === 'https://checkout.paymongo.com' && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function pendingMembershipSelection() {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(checkoutSelectionKey) ?? 'null');
    if (
      !value ||
      !['LIFESTYLE', 'HEALTH'].includes(value.tier) ||
      !['MONTHLY', 'YEARLY'].includes(value.period) ||
      typeof value.savedAt !== 'number' ||
      Date.now() - value.savedAt > 86400000
    )
      return null;
    return value as { tier: PaidMembershipTier; period: MembershipPeriod; savedAt: number };
  } catch {
    return null;
  }
}

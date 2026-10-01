// Types retained for the reused entitlement resolver. Checkout/payment transitions remain retired.
export type BillingSubscriptionState =
  'INCOMPLETE' | 'INCOMPLETE_CANCELLED' | 'ACTIVE' | 'PAST_DUE' | 'UNPAID' | 'CANCELLED' | 'NON_RENEWING' | 'UNKNOWN';
export type BillingInvoiceState = 'DRAFT' | 'OPEN' | 'PAID' | 'VOID' | 'UNKNOWN';

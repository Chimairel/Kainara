export type ProfilePanel = 'account' | 'security' | 'avatar' | 'privacy';
export const ACCOUNT_DELETION_CONFIRMATION = 'DELETE MY KAINARA ACCOUNT';
export interface BasicMealLog {
  id: string;
  source?: string;
  status?: string;
  loggedAt?: string;
  calories?: number;
}

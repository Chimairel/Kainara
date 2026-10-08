import { randomUUID } from 'node:crypto';
import { membershipEnabled } from './membership.policy';
import { testCheckoutConfig } from './membership-checkout.policy';

/** Internal write envelope. The database consumes and clears it before persistence. */
export function mealLogAuditWrite(actorUserId: string | null, reason: string) {
  return {
    writeId: randomUUID(),
    actorUserId,
    reason: reason.slice(0, 2000),
    membershipEnabled: membershipEnabled(),
    checkoutHash: testCheckoutConfig()?.accountHash ?? null,
  };
}

export const MEAL_LOG_AGE_GROUPS = ['18-24', '25-34', '35-44', '45+', 'UNKNOWN'] as const;
export const MEAL_LOG_MEMBERSHIPS = [
  'FREE',
  'FREE_HEALTH',
  'TRIAL_PENDING',
  'LIFESTYLE',
  'HEALTH',
  'DISABLED',
  'UNKNOWN',
] as const;

/** Change detection only. The backend validates authorization and decisions independently. */
export interface ReviewPollStatus {
  available: boolean;
  revision: string;
  claim: { state: 'AVAILABLE' | 'OWNED' | 'OTHER'; claimedAt: string | null };
}

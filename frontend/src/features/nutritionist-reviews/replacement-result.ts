export function replacementResultMessage(data: {
  replacementResult?: {status:string}; replacementPlanId?: string | null; replacementOutcome?: string;
} | undefined): string {
  const status = data?.replacementResult?.status ?? (data?.replacementPlanId ? 'READY_FOR_REVIEW' : data?.replacementOutcome === 'NO_SUITABLE_REPLACEMENT' ? 'HELD' : undefined);
  if(status === 'READY_FOR_REVIEW') return 'Rejection saved. A replacement is ready for review.';
  if(status === 'PREPARATION_FAILED') return 'Rejection saved. Replacement preparation failed; the slot remains unavailable. Do not submit the rejection again.';
  if(status === 'HELD') return 'Rejection saved. This slot is held unavailable; automatic replacement is stopped.';
  if(status === 'NO_CANDIDATE') return 'Rejection saved. No replacement candidate is available yet.';
  return 'Rejection saved. Check the queue for replacement status.';
}

/** An RND may retain a named declaration without claiming it has automated rules. */
export function canReviewDeclarationAsRecorded(entry: {
  domain?: unknown;
  supportState?: unknown;
  displayName?: unknown;
}) {
  return (
    ['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'].includes(String(entry.domain)) &&
    entry.supportState === 'PENDING_REVIEW' &&
    typeof entry.displayName === 'string' &&
    entry.displayName.trim().length >= 2
  );
}

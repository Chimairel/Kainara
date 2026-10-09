export type ClarificationQuestion = {
  id: string;
  label: string;
  required: boolean;
} & ({ type: 'TEXT' } | { type: 'CHOICE'; options: string[] });
export type ClarificationForm = {
  id: string;
  title: string;
  profileRevision: number;
  scopeKey: string;
  createdAt: string;
  authorName: string;
  sourceMeal?: { id: string; mealName: string; scheduledDate: string } | null;
  questions: ClarificationQuestion[];
  status: 'AWAITING_MEMBER' | 'ANSWERED' | 'RESOLVED' | 'SUPERSEDED';
  responses: Array<{ id: string; version: number; answers: Record<string, string>; submittedAt: string }>;
  resolution: { responseId: string; rationale: string; reviewerName: string; resolvedAt: string } | null;
};
export type ClarificationWorkspace = { enabled: boolean; forms: ClarificationForm[] };

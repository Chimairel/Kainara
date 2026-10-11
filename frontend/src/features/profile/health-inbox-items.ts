import type { ClarificationWorkspace } from '@/features/clinical-clarification/types';
import type { ProfileProposalWorkspace } from '@/features/clinical-clarification/profile-proposal-types';
import { formatManilaDate } from '@/lib/manila-date';
import type { HealthInboxItem } from './HealthDetailsInbox';

export const healthAreaLabel = (area: string) =>
  area === 'FOOD_ALLERGY' ? 'Allergy details' : area.replace(/_/g, ' ').toLowerCase();
export const healthAreaKey = (area: string) => `details:${area}`;
const dateLabel = (date: string) =>
  Number.isNaN(new Date(date).getTime()) ? undefined : formatManilaDate(date, { month: 'short', day: 'numeric' });

export function healthInboxItems(workspace: {
  availableAreas: string[];
  requirements: Array<{ area: string; state: string }>;
  clarifications?: ClarificationWorkspace;
  profileProposals?: ProfileProposalWorkspace;
  conditionPlanningAssessments?: unknown[];
}): HealthInboxItem[] {
  const questions: HealthInboxItem[] = workspace.clarifications?.enabled
    ? workspace.clarifications.forms.map((form) => ({
        id: `question:${form.id}`,
        title: form.title,
        sender: `${form.authorName}, RND`,
        kind: 'question',
        status: {
          AWAITING_MEMBER: 'Response needed',
          ANSWERED: 'Awaiting RND review',
          RESOLVED: 'Resolved',
          SUPERSEDED: 'Historical · profile changed',
        }[form.status],
        needsResponse: form.status === 'AWAITING_MEMBER',
        historical: ['RESOLVED', 'SUPERSEDED'].includes(form.status),
        date: dateLabel(form.createdAt),
      }))
    : [];
  const corrections: HealthInboxItem[] = workspace.profileProposals?.enabled
    ? workspace.profileProposals.proposals.map((proposal) => ({
        id: `correction:${proposal.id}`,
        title: 'Proposed profile correction',
        sender: `${proposal.authorName}, RND`,
        kind: 'correction',
        status:
          (
            {
              PENDING: 'Acknowledgment needed',
              ACCEPTED: 'Acknowledged and applied',
              CORRECTION_REQUESTED: 'Correction requested',
              SUPERSEDED: 'Historical · profile changed',
            } as Record<string, string>
          )[proposal.status] ?? proposal.status.replace(/_/g, ' ').toLowerCase(),
        needsResponse: proposal.status === 'PENDING',
        historical: ['ACCEPTED', 'SUPERSEDED'].includes(proposal.status),
        date: dateLabel(proposal.createdAt),
      }))
    : [];
  const details: HealthInboxItem[] = workspace.availableAreas.map((area) => {
    const saved = workspace.requirements.find((item) => item.area === area)?.state === 'READY';
    return {
      id: healthAreaKey(area),
      title: healthAreaLabel(area),
      sender: 'Your health details',
      kind: 'details',
      status: saved ? 'Details saved' : 'Details needed',
      needsResponse: !saved,
      historical: false,
    };
  });
  const assessments: HealthInboxItem[] = workspace.conditionPlanningAssessments?.length
    ? [
        {
          id: 'assessments',
          title: 'Condition assessments',
          sender: 'RND review',
          kind: 'assessment',
          status: 'Recorded assessments',
          needsResponse: false,
          historical: false,
        },
      ]
    : [];
  return [...questions, ...corrections, ...details, ...assessments].sort(
    (a, b) => Number(b.needsResponse) - Number(a.needsResponse)
  );
}

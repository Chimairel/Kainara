'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import api from '@/lib/axios';

type GovernanceClearance = {
  id: string;
  mealLibraryId: string;
  condition: string;
  assuranceTier: string;
  state: string;
  auditReason?: string;
  uniqueUserExposure?: number;
  mealLibrary: { mealName: string };
};

type DisputedPlan = {
  id: string;
  mealName: string;
  mealType: string;
  scheduledDate: string;
  user: { name: string };
};
type DueProfileApproval = {
  id: string;
  mealLibraryId: string;
  flaggedAt: string | null;
  flagReason: string | null;
  mealLibrary: { mealName: string };
};

export default function GovernanceQueuePanel({ tab }: { tab: 'audit' | 'disputed' }) {
  const [data, setData] = useState<{
    clearances: GovernanceClearance[];
    plans?: DisputedPlan[];
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dueProfiles, setDueProfiles] = useState<DueProfileApproval[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<DueProfileApproval | null>(null);
  const [caseDetail, setCaseDetail] = useState<{
    recordedScope: unknown;
    originatingPlan: { mealName: string; calories: number } | null;
    linkedUserCurrentProfile: { name: string; conditions: string[]; allergies: string[] } | null;
  } | null>(null);

  const load = useCallback(async () => {
    setMessage(null);
    try {
      const response = await api.get(`/nutritionist/governance/queue?view=${tab}`);
      setData(response.data.data);
      if (tab === 'audit') {
        const due = await api.get('/nutritionist/approval-follow-ups');
        setDueProfiles(due.data.data ?? []);
      } else setDueProfiles([]);
    } catch {
      setMessage('Governance queue could not be loaded.');
    }
  }, [tab]);

  useVisiblePolling(
    async () => {
      await load();
    },
    { enabled: true, immediate: false, scopeKey: tab }
  );
  useEffect(() => {
    void load();
  }, [load]);

  const decide = async (url: string, decision: 'APPROVE' | 'REJECT') => {
    const rationale = window.prompt('Record the clinical rationale for this decision.');
    if (!rationale?.trim()) return;
    try {
      await api.post(url, { decision, rationale: rationale.trim() });
      setMessage('Decision recorded.');
      await load();
    } catch {
      setMessage('The decision could not be recorded. Check reviewer eligibility and independence.');
    }
  };

  const suspend = async (id: string) => {
    const reason = window.prompt('Why should this reusable clearance be suspended?');
    if (!reason?.trim()) return;
    try {
      await api.post(`/nutritionist/condition-clearances/${id}/suspend`, { reason: reason.trim() });
      setMessage('Clearance suspended; future matching now fails closed.');
      await load();
    } catch {
      setMessage('A verified nutritionist with a current license is required to suspend this approval.');
    }
  };

  const recheck = async (mealId: string, approvalId: string, kind: 'PROFILE' | 'CONDITION') => {
    const rationale = window.prompt('Record your findings for this approval recheck (at least 10 characters).');
    if (!rationale || rationale.trim().length < 10) return;
    try {
      await api.post(`/nutritionist/library/${mealId}/approvals/${approvalId}/recheck`, {
        kind,
        rationale: rationale.trim(),
      });
      setMessage('Approval review recorded.');
      setSelectedProfile(null);
      setCaseDetail(null);
      await load();
    } catch {
      setMessage(
        'This approval could not be rechecked. Open its current case evidence and verify reviewer eligibility.'
      );
    }
  };
  const inspectProfile = async (approval: DueProfileApproval) => {
    setSelectedProfile(approval);
    setCaseDetail(null);
    try {
      const response = await api.get(
        `/nutritionist/library/${approval.mealLibraryId}/approvals/PROFILE/${approval.id}`
      );
      setCaseDetail(response.data.data);
    } catch {
      setMessage('The approval case could not be opened.');
    }
  };

  return (
    <div className="portal-page space-y-5">
      <div className="rounded-2xl border border-brand-green/20 bg-brand-surface p-5">
        <h1 className="font-display text-2xl font-black text-brand-text">
          {tab === 'audit' ? 'Reusable evidence audit queue' : 'Disputed decisions'}
        </h1>
        <p className="mt-2 text-sm text-brand-muted">
          {tab === 'audit'
            ? 'Review manually flagged or suspended approvals and unfinished decisions.'
            : 'Disagreements remain blocked until an nutritionist who was not involved resolves them.'}
        </p>
      </div>
      {message && (
        <div role="status" className="rounded-xl border border-brand-border p-3 text-sm text-brand-muted">
          {message}
        </div>
      )}
      {!data ? (
        <div className="p-8 text-center text-sm text-brand-muted">Loading governance queue…</div>
      ) : (
        <div className="space-y-3">
          {data.clearances.map((clearance) => (
            <div key={clearance.id} className="rounded-2xl border border-brand-border bg-brand-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-brand-text">{clearance.mealLibrary.mealName}</p>
                  <p className="mt-1 text-xs text-brand-muted">
                    {clearance.condition} · {clearance.assuranceTier} · {clearance.state}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#8c3b00] dark:text-[#ff8a3d]">
                    {clearance.auditReason || `Used by ${clearance.uniqueUserExposure ?? 0} members`}
                  </p>
                </div>
                {
                  <div className="flex gap-2">
                    {tab === 'disputed' ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            void decide(`/nutritionist/condition-clearances/${clearance.id}/resolve`, 'APPROVE')
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            void decide(`/nutritionist/condition-clearances/${clearance.id}/resolve`, 'REJECT')
                          }
                        >
                          Reject
                        </Button>
                      </>
                    ) : (
                      <>
                        {(clearance.state === 'REVIEW_DUE' || clearance.state === 'SUSPENDED') && (
                          <Button
                            size="sm"
                            onClick={() => void recheck(clearance.mealLibraryId, clearance.id, 'CONDITION')}
                          >
                            Recheck
                          </Button>
                        )}
                        {clearance.state === 'ACTIVE' && (
                          <Button size="sm" variant="secondary" onClick={() => void suspend(clearance.id)}>
                            Suspend
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                }
              </div>
            </div>
          ))}
          {tab === 'audit' &&
            dueProfiles.map((approval) => (
              <div key={approval.id} className="rounded-2xl border border-brand-border bg-brand-surface p-4">
                <p className="font-bold">{approval.mealLibrary.mealName}</p>
                <p className="text-xs text-brand-muted">Profile approval · Flagged</p>
                {approval.flagReason && (
                  <p className="text-xs text-[#8c3b00] dark:text-[#ff8a3d]">{approval.flagReason}</p>
                )}
                <Button size="sm" variant="secondary" onClick={() => void inspectProfile(approval)}>
                  View case
                </Button>
                {selectedProfile?.id === approval.id && caseDetail && (
                  <div className="mt-3 rounded-xl border border-brand-border p-3 text-sm">
                    <p>
                      Original meal: {caseDetail.originatingPlan?.mealName ?? approval.mealLibrary.mealName} ·{' '}
                      {caseDetail.originatingPlan?.calories ?? 'Unknown'} kcal
                    </p>
                    <p>Linked member now: {caseDetail.linkedUserCurrentProfile?.name ?? 'Unavailable'}</p>
                    <p className="text-xs text-brand-muted">
                      Current conditions: {caseDetail.linkedUserCurrentProfile?.conditions.join(', ') || 'none'} ·
                      Allergies: {caseDetail.linkedUserCurrentProfile?.allergies.join(', ') || 'none'}. Review the
                      recorded context before renewal.
                    </p>
                    <Button size="sm" onClick={() => void recheck(approval.mealLibraryId, approval.id, 'PROFILE')}>
                      Review flagged approval
                    </Button>
                  </div>
                )}
              </div>
            ))}
          {tab === 'disputed' &&
            (data.plans || []).map((plan) => (
              <div key={plan.id} className="rounded-2xl border border-status-error-text/25 bg-brand-surface p-4">
                <p className="font-bold text-brand-text">{plan.mealName}</p>
                <p className="mt-1 text-xs text-brand-muted">
                  {plan.user.name} · {plan.mealType}
                </p>
                {
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => void decide(`/nutritionist/review/${plan.id}/dispute-resolution`, 'APPROVE')}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void decide(`/nutritionist/review/${plan.id}/dispute-resolution`, 'REJECT')}
                    >
                      Reject
                    </Button>
                  </div>
                }
              </div>
            ))}
          {data.clearances.length === 0 && dueProfiles.length === 0 && (data.plans?.length ?? 0) === 0 && (
            <div className="rounded-2xl border border-dashed border-brand-border p-10 text-center text-sm text-brand-muted">
              Queue is clear.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

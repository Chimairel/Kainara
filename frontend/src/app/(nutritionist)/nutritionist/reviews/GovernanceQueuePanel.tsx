'use client';

import { formatMealTitle } from '@/lib/meal-title';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useCallback, useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import ApprovalRecheckCanvas, {
  type ApprovalReviewTarget,
} from '@/features/nutritionist-reviews/ApprovalRecheckCanvas';
import Skeleton from '@/components/ui/Skeleton';
import api from '@/lib/axios';
import Link from 'next/link';

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

type DueProfileApproval = {
  id: string;
  mealLibraryId: string;
  flaggedAt: string | null;
  flagReason: string | null;
  mealLibrary: { mealName: string };
};

export default function GovernanceQueuePanel({ tab }: { tab: 'audit' }) {
  const [data, setData] = useState<{
    clearances: GovernanceClearance[];
  } | null>(null);
  const [reviewTarget, setReviewTarget] = useState<ApprovalReviewTarget | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [dueProfiles, setDueProfiles] = useState<DueProfileApproval[]>([]);
  const [caseFlags, setCaseFlags] = useState<Array<{ id: string; mealPlanId: string; mealName: string; explanation: string }>>([]);
  const [selectedProfile, setSelectedProfile] = useState<DueProfileApproval | null>(null);
  const [caseDetail, setCaseDetail] = useState<{
    recordedScope: unknown;
    originatingPlan: { mealName: string; calories: number } | null;
    linkedUserCurrentProfile: { name: string; conditions: string[]; allergies: string[] } | null;
  } | null>(null);

  const load = useCallback(async () => {
    setMessage(null);
    try {
      const [response, due, cases] = await Promise.all([
        api.get(`/nutritionist/governance/queue?view=${tab}`),
        api.get('/nutritionist/approval-follow-ups'),
        api.get('/nutritionist/case-approval-follow-ups'),
      ]);
      if (!Array.isArray(response.data?.data?.clearances) ||
        !Array.isArray(due.data?.data) || !Array.isArray(cases.data?.data)) {
        throw new Error('Governance queue returned incomplete evidence.');
      }
      setData(response.data.data);
      setDueProfiles(due.data.data);
      setCaseFlags(cases.data.data);
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

  const suspend = async (id: string) => {
    const reason = window.prompt('Why should this reusable clearance be suspended?');
    if (!reason?.trim()) return;
    try {
      await api.post(`/nutritionist/condition-clearances/${id}/suspend`, { reason: reason.trim() });
      setMessage('Clearance suspended; future matching now fails closed.');
      await load();
    } catch {
      setMessage('A verified RND with a current license is required to suspend this approval.');
    }
  };

  const recheck = async (mealId: string, approvalId: string, kind: 'PROFILE' | 'CONDITION') => {
    setReviewTarget({ mealLibraryId: mealId, approvalId, kind });
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
      {reviewTarget && (
        <ApprovalRecheckCanvas target={reviewTarget} onClose={() => setReviewTarget(null)} onVerified={load} />
      )}
      <div className="rounded-2xl border border-brand-green/20 bg-brand-surface p-5">
        <h1 className="font-display text-2xl font-black text-brand-text">Flagged approvals</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Review flagged or suspended approvals against their recorded evidence.
        </p>
      </div>
      {caseFlags.length > 0 && <section aria-label="Flagged case approvals" className="space-y-3">
        {caseFlags.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-brand-border bg-brand-surface p-5">
          <div><h2 className="font-bold">{formatMealTitle(item.mealName)}</h2><p className="mt-1 text-sm text-brand-muted">{item.explanation}</p></div>
          <Link className="font-semibold text-brand-green underline" href={`/nutritionist/reviews?caseId=${encodeURIComponent(item.mealPlanId)}`}>Open case re-review</Link>
        </div>)}
      </section>}
      {message && (
        <div role="status" className="rounded-xl border border-brand-border p-3 text-sm text-brand-muted">
          {message}
        </div>
      )}
      {!data ? (
        <div className="space-y-3" aria-label="Loading governance queue">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-brand-border/70 bg-brand-surface p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2 flex-1 min-w-[200px]">
                  <Skeleton className="h-5 w-48 rounded" />
                  <Skeleton className="h-3.5 w-64 rounded" />
                  <Skeleton className="h-3.5 w-36 rounded" />
                </div>
                <Skeleton className="h-8 w-24 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {data.clearances.map((clearance) => (
            <div key={clearance.id} className="rounded-2xl border border-brand-border bg-brand-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-brand-text">{formatMealTitle(clearance.mealLibrary.mealName)}</p>
                  <p className="mt-1 text-xs text-brand-muted">
                    {clearance.condition} · {clearance.assuranceTier} · {clearance.state}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#8c3b00] dark:text-[#ff8a3d]">
                    {clearance.auditReason || `Used by ${clearance.uniqueUserExposure ?? 0} members`}
                  </p>
                </div>
                {
                  <div className="flex gap-2">
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
                  </div>
                }
              </div>
            </div>
          ))}
          {dueProfiles.map((approval) => (
            <div key={approval.id} className="rounded-2xl border border-brand-border bg-brand-surface p-4">
              <p className="font-bold">{formatMealTitle(approval.mealLibrary.mealName)}</p>
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
                    Original meal:{' '}
                    {formatMealTitle(caseDetail.originatingPlan?.mealName ?? approval.mealLibrary.mealName)} ·{' '}
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
          {data.clearances.length === 0 && dueProfiles.length === 0 && (
            <div className="rounded-2xl border border-dashed border-brand-border p-10 text-center text-sm text-brand-muted">
              Queue is clear.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

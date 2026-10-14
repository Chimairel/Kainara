'use client';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import ReviewCanvas, { type ReviewCanvasLayout } from './ReviewCanvas';
import CaseFlagConcernSheet from './CaseFlagConcernSheet';
import type { DetailData } from './review-types';
import CaseEvidenceSheets from './CaseEvidenceSheets';
import RelatedConditionReviews from './RelatedConditionReviews';
import { ReviewDocumentPage } from './RndQueueDocument';
import { savedReviewPresentation } from './saved-review-presentation';
import FlagReasonFields, { emptyFlagReason, flagReasonPayload, useFlagReasonDraft, validFlagReason } from './FlagReasonFields';

export type ApprovalFlagTarget = { url: string; expectedVersion: string; canFlag: boolean; flagged: boolean };
export default function SavedApprovalCanvas({ snapshot, approvalFlag, decisionId, recordedConcern }: {
  recordedConcern?: NonNullable<DetailData['flagConcerns']>[number] | null;
  snapshot: unknown; approvalFlag?: ApprovalFlagTarget | null; decisionId: string;
}) {
  const { detail, layout, exact, related } = useMemo(() => savedReviewPresentation(snapshot), [snapshot]);
  const [expanded, setExpanded] = useState(false);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useFlagReasonDraft();
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [request, setRequest] = useState(0);
  const latestLayout = useRef<ReviewCanvasLayout | null>(layout);
  const beforeFlag = useRef<ReviewCanvasLayout | null>(null);
  const [restore, setRestore] = useState<{ layout: ReviewCanvasLayout; request: number } | null>(null);
  const lastPage = 2 + (detail.flagConcerns?.length ? 1 : 0) + (detail.clarifications?.forms.length ?? 0) + (related ? 1 : 0) + (recordedConcern ? 1 : 0);
  const cancel = () => {
    setDraft({ ...emptyFlagReason }); setWriting(false);
    if (beforeFlag.current) setRestore(previous => ({ layout: beforeFlag.current!, request: (previous?.request ?? 0) + 1 }));
  };
  async function submit() {
    if (!approvalFlag?.canFlag || busy || !validFlagReason(draft)) return;
    setBusy(true);
    try {
      const response = await api.post(approvalFlag.url, { expectedVersion: approvalFlag.expectedVersion, notes: flagReasonPayload(draft) });
      if (!response.data?.success) throw new Error('Flag was not confirmed.');
      cancel(); setSubmitted(true); toast.success('Approval flagged for independent review.');
    } catch (error) { toast.error(getApiErrorMessage(error, 'The approval could not be flagged. Reopen its saved review.')); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    {!exact && <p className="text-sm text-brand-muted">This older approval did not save its canvas layout. These pages use only the evidence recorded at approval.</p>}
    <ReviewCanvas stackOnMobile readOnly title={`Case approval · ${detail.mealPlan.mealName}`} contentKey={decisionId} initialLayout={layout}
      restoreLayout={restore} onLayoutChange={value => { latestLayout.current = value; }}
      expanded={expanded} onExpandedChange={value => { if (!busy) setExpanded(value); }}
      focusSheet={writing ? { title: 'Flag approval reasons', request } : undefined}
      actions={approvalFlag && <Button variant={writing ? 'secondary' : 'danger'} size="sm" disabled={busy || submitted || (!writing && !approvalFlag.canFlag)} onClick={() => {
        if (writing) cancel(); else { beforeFlag.current = latestLayout.current; setWriting(true); setRequest(value => value + 1); }
      }}>{writing ? 'Cancel' : submitted || approvalFlag.flagged ? 'Approval flagged' : 'Flag approval'}</Button>}>
      {CaseEvidenceSheets({ detailData: detail })}
      {related && <ReviewDocumentPage page={lastPage - Number(Boolean(recordedConcern))} title="Related condition reviews" subtitle="Completed decisions for this case’s conditions">
        <RelatedConditionReviews detail={detail} saved={related} />
      </ReviewDocumentPage>}
      {recordedConcern && <ReviewDocumentPage page={lastPage} title="Recorded approval flag" subtitle="Saved concern and resolution">
        <CaseFlagConcernSheet concerns={[recordedConcern]} canWrite={false} onUpdated={async () => {}} />
      </ReviewDocumentPage>}
      {writing && <ReviewDocumentPage page={lastPage + 1} title="Flag approval reasons" subtitle="Draft · not submitted">
        <p className="mb-6 text-sm">Submitting suspends this approval and meals that reused it. It does not flag the entire recipe.</p>
        <form className="space-y-6" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <FlagReasonFields value={draft} onChange={setDraft} busy={busy} />
          <Button variant="danger" type="submit" isLoading={busy} disabled={busy || !validFlagReason(draft)}>Submit approval flag</Button>
        </form>
      </ReviewDocumentPage>}
    </ReviewCanvas>
  </div>;
}

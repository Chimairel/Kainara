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
import ReviewDecisionPage from './ReviewDecisionPage';
import FlagReasonFields, { flagReasonPayload, validFlagReason } from './FlagReasonFields';
import { useFlagDraft } from './useFlagDraft';
import FlagDraftNotice from './FlagDraftNotice';

export type ApprovalFlagTarget = { url: string; expectedVersion: string; canFlag: boolean; flagged: boolean };
export default function SavedApprovalCanvas({ snapshot, approvalFlag, decisionId, recordedConcern }: {
  recordedConcern?: NonNullable<DetailData['flagConcerns']>[number] | null;
  snapshot: unknown; approvalFlag?: ApprovalFlagTarget | null; decisionId: string;
}) {
  const { detail, layout, exact, related } = useMemo(() => savedReviewPresentation(snapshot), [snapshot]);
  const [expanded, setExpanded] = useState(false);
  const flagDraft = useFlagDraft(approvalFlag ? { kind: 'CASE', targetId: decisionId } : null, approvalFlag?.expectedVersion);
  const { writing, notes: draft, setNotes: setDraft } = flagDraft;
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [request, setRequest] = useState(0);
  const latestLayout = useRef<ReviewCanvasLayout | null>(layout);
  const beforeFlag = useRef<ReviewCanvasLayout | null>(null);
  const [restore, setRestore] = useState<{ layout: ReviewCanvasLayout; request: number } | null>(null);
  const rationale = snapshot && typeof snapshot === 'object' && 'reviewRationale' in snapshot && typeof snapshot.reviewRationale === 'string' ? snapshot.reviewRationale : null;
  const hasRationalePage = Boolean(layout?.sheets.some(sheet => sheet.title === 'Approval rationale'));
  const lastPage = 2 + (detail.flagConcerns?.length ? 1 : 0) + (detail.clarifications?.forms.length ?? 0) + (related ? 1 : 0) + (recordedConcern ? 1 : 0) + Number(hasRationalePage);
  const restoreBeforeFlag = () => {
    if (beforeFlag.current) setRestore(previous => ({ layout: beforeFlag.current!, request: (previous?.request ?? 0) + 1 }));
  };
  const cancel = async () => { if (await flagDraft.cancel()) restoreBeforeFlag(); };
  async function submit() {
    if (!approvalFlag?.canFlag || busy || !flagDraft.draftId || !validFlagReason(draft)) return;
    setBusy(true);
    try {
      if (!await flagDraft.save()) return;
      const response = await api.post(approvalFlag.url, { expectedVersion: approvalFlag.expectedVersion, flagDraftId: flagDraft.draftId, notes: flagReasonPayload(draft) });
      if (!response.data?.success) throw new Error('Flag was not confirmed.');
      flagDraft.completed(); restoreBeforeFlag(); setSubmitted(true); toast.success('Approval flagged for independent review.');
    } catch (error) { toast.error(getApiErrorMessage(error, 'The approval could not be flagged. Reopen its saved review.')); }
    finally { setBusy(false); }
  }
  return <div className="space-y-3">
    <FlagDraftNotice draft={flagDraft} />
    {!exact && <p className="text-sm text-brand-muted">This older approval did not save its canvas layout. These pages use only the evidence recorded at approval.</p>}
    <ReviewCanvas stackOnMobile readOnly title={`Case approval · ${detail.mealPlan.mealName}`} contentKey={decisionId} initialLayout={layout}
      restoreLayout={restore} onLayoutChange={value => { latestLayout.current = value; }}
      expanded={expanded} onExpandedChange={value => { if (!busy) setExpanded(value); }}
      focusSheet={writing ? { title: 'Flag approval reasons', request } : undefined}
      actions={approvalFlag && <div className="flex max-w-sm flex-col items-end gap-1"><Button variant={writing ? 'secondary' : 'danger'} size="sm" disabled={busy || flagDraft.busy || submitted || (!writing && (!approvalFlag.canFlag || !flagDraft.ready))} onClick={() => {
        if (writing) void cancel(); else { beforeFlag.current = latestLayout.current; void flagDraft.begin().then(ok => { if (ok) setRequest(value => value + 1); }); }
      }}>{writing ? 'Cancel' : submitted || approvalFlag.flagged ? 'Approval flagged' : flagDraft.status?.blocked ? 'Flag in progress' : 'Flag approval'}</Button><FlagDraftNotice draft={flagDraft} compact /></div>}>
      {CaseEvidenceSheets({ detailData: detail })}
      {related && <ReviewDocumentPage page={lastPage - Number(Boolean(recordedConcern)) - Number(hasRationalePage)} title="Related condition reviews" subtitle="Completed decisions for this case’s conditions">
        <RelatedConditionReviews detail={detail} saved={related} />
      </ReviewDocumentPage>}
      {recordedConcern && <ReviewDocumentPage page={lastPage - Number(hasRationalePage)} title="Recorded approval flag" subtitle="Saved concern and resolution">
        <CaseFlagConcernSheet concerns={[recordedConcern]} canWrite={false} onUpdated={async () => {}} />
      </ReviewDocumentPage>}
      {hasRationalePage && <ReviewDecisionPage page={lastPage} title="Approval rationale" action="approve" readOnly
        note={rationale ?? ''} onNoteChange={() => {}} onClose={() => {}} onConfirm={() => {}} busy={false} />}
      {writing && <ReviewDocumentPage page={lastPage + 1} title="Flag approval reasons" subtitle="Draft · not submitted">
        <p className="mb-6 text-sm">Submitting suspends this approval and meals that reused it. It does not flag the entire recipe.</p>
        <form className="space-y-6" onSubmit={event => { event.preventDefault(); void submit(); }}>
          <FlagReasonFields value={draft} onChange={setDraft} busy={busy} />
          <FlagDraftNotice draft={flagDraft} />
          <Button variant="danger" type="submit" isLoading={busy} disabled={busy || flagDraft.busy || Boolean(flagDraft.error) || !validFlagReason(draft)}>Submit approval flag</Button>
        </form>
      </ReviewDocumentPage>}
    </ReviewCanvas>
  </div>;
}

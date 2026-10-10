'use client';

import { useState, type ReactNode } from 'react';
import { Select } from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import ReviewCanvas from '@/features/nutritionist-reviews/ReviewCanvas';
import { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
import MealReviewTimeline, { type ReviewIncident } from '@/features/nutritionist-library/MealReviewTimeline';
import RecordedCaseFields, { recordedObject, recordValue } from './RecordedCaseFields';
import AdminDecisionSheets from './AdminDecisionSheets';

export type ReviewContext = {
  currentProfile: unknown;
  reviewedSnapshot: unknown;
  decisions: unknown;
  selectedDecisionId?: string | null;
  clinicalEvidence: { id?: string; documentType?: string; originalFileName?: string }[];
  historicalInformation: string | null;
  recipe?: { history: ReviewIncident[]; legacyHistoryUnknown: boolean };
};

/** Admin adapter for the same movable-sheet canvas used by RNDs. No clinical decision controls. */
export default function CaseReviewDocument({
  data,
  onDownload,
  error,
}: {
  data: ReviewContext;
  onDownload: (record: ReviewContext['clinicalEvidence'][number]) => void;
  error?: string | null;
}) {
  const decisions = Array.isArray(data.decisions) ? data.decisions : data.decisions == null ? [] : [data.decisions];
  const records = [
    ...decisions
      .map((value, index) => {
        const decision = recordedObject(value);
        const action = decision?.action ?? decision?.decision ?? decision?.status;
        const date = decision?.submittedAt ?? decision?.createdAt ?? decision?.reviewedAt;
        return {
          key: `decision-${index}`,
          id: decision?.id,
          title: `Review change ${index + 1}`,
          label: `Change ${index + 1}${action ? ` · ${recordValue(action)}` : ''}${date ? ` · ${recordValue(date)}` : ''}`,
          value,
          kind: 'decision',
        };
      })
      .reverse(),
    ...(data.reviewedSnapshot != null
      ? [
          {
            key: 'snapshot',
            id: null,
            title: 'Profile recorded for review',
            label: 'Profile recorded for review',
            value: data.reviewedSnapshot,
            kind: 'snapshot',
          },
        ]
      : []),
    ...(data.currentProfile != null
      ? [
          {
            key: 'current',
            id: null,
            title: 'Current member profile',
            label: 'Current member profile · Live details',
            value: data.currentProfile,
            kind: 'current',
          },
        ]
      : []),
    ...(data.recipe
      ? [
          {
            key: 'recipe',
            id: null,
            title: 'Recipe review history',
            label: 'Recipe review history',
            value: data.recipe,
            kind: 'recipe',
          },
        ]
      : []),
    {
      key: 'evidence',
      id: null,
      title: 'Clinical evidence attached to this case',
      label: `Clinical evidence · ${data.clinicalEvidence.length} records`,
      value: data.clinicalEvidence,
      kind: 'evidence',
    },
  ];
  const [selected, setSelected] = useState(
    () => records.find((item) => data.selectedDecisionId && item.id === data.selectedDecisionId)?.key ?? records[0].key
  );
  const [expanded, setExpanded] = useState(false);
  const record = records.find((item) => item.key === selected) ?? records[0];
  const subtitle =
    record.kind === 'current'
      ? 'Live profile at the time you opened this case. These values do not replace any historical review snapshot.'
      : record.kind === 'evidence'
        ? 'Related document metadata at access time. Recorded document versions remain in each decision snapshot.'
        : 'Saved review evidence. Missing historical information is labeled as not recorded.';
  let sheets: ReactNode;
  if (record.kind === 'decision') {
    const questions = recordedObject(data.reviewedSnapshot)?.questions;
    sheets = AdminDecisionSheets({
      title: record.title,
      value: record.value,
      subtitle,
      recordedQuestions: Array.isArray(questions) ? questions : undefined,
    });
  } else {
    sheets = (
      <ReviewDocumentPage
        page={1}
        title={record.title}
        subtitle={subtitle}
        recordLabel="Admin oversight"
        footer="Read-only case oversight · Access to clinical details is recorded"
      >
        {record.kind === 'recipe' && data.recipe ? (
          <MealReviewTimeline history={data.recipe.history} legacyHistoryUnknown={data.recipe.legacyHistoryUnknown} />
        ) : (
          <RecordedCaseFields value={record.value} paper />
        )}
        {record.kind === 'evidence' &&
          data.clinicalEvidence
            .filter((document) => document.id)
            .map((document) => (
              <Button key={document.id} variant="secondary" size="sm" onClick={() => onDownload(document)}>
                Download related {document.documentType?.replaceAll('_', ' ').toLowerCase() || 'clinical record'}
              </Button>
            ))}
      </ReviewDocumentPage>
    );
  }
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-brand-muted">Choose a recorded change or related case details</p>
        <Select
          aria-label="Case record"
          value={record.key}
          onChange={setSelected}
          options={records.map((item) => ({ value: item.key, label: item.label }))}
          className="w-full"
        />
      </div>
      <div className="h-[clamp(28rem,75dvh,52rem)] min-w-0">
        <ReviewCanvas
          readOnly
          className="!h-full !min-h-0"
          title="Case review record"
          contentKey={record.key}
          expanded={expanded}
          onExpandedChange={setExpanded}
          actions={
            <div className="max-w-lg space-y-1 text-xs text-brand-muted">
              <p>Read-only admin oversight</p>
              {data.historicalInformation && <p>{data.historicalInformation}</p>}
              {error && (
                <p role="alert" className="text-status-error-text">
                  {error}
                </p>
              )}
            </div>
          }
        >
          {sheets}
        </ReviewCanvas>
      </div>
    </div>
  );
}

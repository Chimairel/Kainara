'use client';

import { useState } from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import RecordPaper from '@/components/shared/RecordPaper';
import SplitWorkspace from '@/components/shared/SplitWorkspace';
import CardDecoration from '@/components/ui/CardDecoration';
import { Select } from '@/components/ui/Select';
import Button from '@/components/ui/Button';
import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';
import MealReviewTimeline, { type ReviewIncident } from '@/features/nutritionist-library/MealReviewTimeline';
import RecordedCaseFields, { recordedObject, recordValue } from './RecordedCaseFields';

export type ReviewContext = {
  currentProfile: unknown;
  reviewedSnapshot: unknown;
  decisions: unknown;
  clinicalEvidence: { id?: string; documentType?: string; originalFileName?: string }[];
  historicalInformation: string | null;
  recipe?: { history: ReviewIncident[]; legacyHistoryUnknown: boolean };
};

export default function CaseReviewDocument({
  data,
  onDownload,
}: {
  data: ReviewContext;
  onDownload: (record: ReviewContext['clinicalEvidence'][number]) => void;
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
            title: 'Current member profile',
            label: 'Current member profile · Live details',
            value: data.currentProfile,
            kind: 'current',
          },
        ]
      : []),
    {
      key: 'evidence',
      title: 'Clinical evidence attached to this case',
      label: `Clinical evidence · ${data.clinicalEvidence.length} records`,
      value: data.clinicalEvidence,
      kind: 'evidence',
    },
  ];
  const [selected, setSelected] = useState(records[0].key);
  const [expanded, setExpanded] = useState(false);
  const record = records.find((item) => item.key === selected) ?? records[0];
  const picker = (
    <div className="mb-4 space-y-1.5">
      <p className="text-xs font-bold text-brand-muted">Choose a recorded change or related case details</p>
      <Select
        aria-label="Case record"
        value={record.key}
        onChange={setSelected}
        options={records.map((item) => ({ value: item.key, label: item.label }))}
        className="w-full"
      />
    </div>
  );
  return (
    <div className="space-y-4">
      {data.recipe && (
        <MealReviewTimeline history={data.recipe.history} legacyHistoryUnknown={data.recipe.legacyHistoryUnknown} />
      )}
      {(data.currentProfile != null ||
        data.reviewedSnapshot != null ||
        decisions.length > 0 ||
        data.clinicalEvidence.length > 0) && (
        <>
          <SplitWorkspace
            aria-label="Related case report"
            className="h-[clamp(24rem,70dvh,48rem)] bg-[#faf8f5] dark:bg-[#071914] shadow-xl"
          >
            <CardDecoration variant="report" />
            <ExpandableCasePanel
              expanded={expanded}
              onExpandedChange={setExpanded}
              expandTitle="Full screen audit report"
              expandAriaLabel="Expanded audit report"
              headerLeft={
                <span className="flex items-center gap-2 text-sm font-bold">
                  <FileText className="h-4 w-4 text-brand-green" aria-hidden="true" />
                  Case review record
                </span>
              }
              className="relative z-10 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
              headerClassName="border-b border-brand-border/80 bg-white/60 dark:bg-[#071914]/60 backdrop-blur-md"
              contentKey={record.key}
              contentClassName="min-h-0 flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-3 sm:p-5 xl:p-6"
            >
              {picker}
              <RecordPaper aria-label={record.title}>
                <header className="space-y-3 border-b border-brand-border/70 pb-4">
                  <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-green">
                    KAINARA · Admin oversight
                  </p>
                  <h3 className="font-display text-xl font-extrabold tracking-tight sm:text-2xl">{record.title}</h3>
                  <p className="text-sm leading-relaxed text-brand-muted">
                    {record.kind === 'current'
                      ? 'Live profile at the time you opened this case. These values do not replace any historical review snapshot.'
                      : record.kind === 'evidence'
                        ? 'Original records connected to this review case.'
                        : 'Saved review evidence. Missing historical information is labeled as not recorded.'}
                  </p>
                  {data.historicalInformation && (
                    <p className="text-sm text-brand-muted">{data.historicalInformation}</p>
                  )}
                </header>
                <RecordedCaseFields value={record.value} />
                {record.kind === 'evidence' &&
                  data.clinicalEvidence
                    .filter((document) => document.id)
                    .map((document) => (
                      <Button key={document.id} variant="secondary" size="sm" onClick={() => onDownload(document)}>
                        Download related{' '}
                        {document.documentType?.replaceAll('_', ' ').toLowerCase() || 'clinical record'}
                      </Button>
                    ))}
                <footer className="flex items-start gap-2 border-t border-brand-border/70 pt-4 text-xs leading-relaxed text-brand-muted">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-brand-green" aria-hidden="true" />
                  Read-only case oversight. Access to clinical details is recorded.
                </footer>
              </RecordPaper>
            </ExpandableCasePanel>
          </SplitWorkspace>
        </>
      )}
      {!data.recipe &&
        data.currentProfile == null &&
        data.reviewedSnapshot == null &&
        !decisions.length &&
        !data.clinicalEvidence.length && (
          <RecordPaper>
            <h3 className="font-display text-lg font-bold">Related case details</h3>
            <p className="text-sm text-brand-muted">
              {data.historicalInformation || 'No related clinical details were recorded.'}
            </p>
          </RecordPaper>
        )}
    </div>
  );
}

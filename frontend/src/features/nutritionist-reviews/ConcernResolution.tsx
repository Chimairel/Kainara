'use client';
import Button from '@/components/ui/Button';
import { formatManilaDate } from '@/lib/manila-date';

export type ReviewConcern = {
  id: string;
  createdAt?: string;
  actorSnapshot?: { name?: string; role?: string };
  notes: {
    category?: string;
    affectedFields?: string[];
    explanation: string;
    reference?: string;
    proposedCorrection?: string;
  };
};
/** A resolution is a version-bound draft until its guarded verification is submitted. */
export default function ConcernResolution({
  concern,
  note,
  resolved,
  canWrite,
  onNote,
  onResolve,
  maxLength = 3000,
}: {
  concern: ReviewConcern;
  note: string;
  resolved: boolean;
  canWrite: boolean;
  onNote: (value: string) => void;
  onResolve: () => void;
  maxLength?: number;
}) {
  return (
    <section
      aria-label={`Flag concern ${concern.id}`}
      className="space-y-4 border-b border-brand-border pb-6 last:border-0"
    >
      <div>
        <h3 className="text-base font-bold">{concern.notes.category ?? 'Recorded concern'}</h3>
        <p className="mt-1 text-xs text-brand-muted">
          {concern.actorSnapshot?.name ?? 'Reviewer not recorded'}
          {concern.createdAt ? ` · ${formatManilaDate(concern.createdAt, { dateStyle: 'medium' })}` : ''}
        </p>
      </div>
      {concern.notes.affectedFields?.length ? (
        <p className="text-xs text-brand-muted">Affected: {concern.notes.affectedFields.join(', ')}</p>
      ) : null}
      <p className="whitespace-pre-wrap text-sm leading-6">{concern.notes.explanation}</p>
      {concern.notes.reference && (
        <p className="whitespace-pre-wrap text-sm">
          <strong>Evidence: </strong>
          {concern.notes.reference}
        </p>
      )}
      {concern.notes.proposedCorrection && (
        <p className="whitespace-pre-wrap text-sm">
          <strong>Proposed correction: </strong>
          {concern.notes.proposedCorrection}
        </p>
      )}
      {canWrite && (
        <>
          <label className="block text-sm font-semibold">
            How you resolved this concern
            <textarea
              value={note}
              onChange={(event) => onNote(event.target.value)}
              minLength={20}
              maxLength={maxLength}
              rows={4}
              placeholder="Describe what you checked, what was corrected and why the concern is resolved."
              className="mt-2 w-full rounded-xl border border-brand-border bg-brand-surface p-3 text-sm font-normal text-brand-text outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" disabled={resolved || note.trim().length < 20} onClick={onResolve}>
              {resolved ? 'Resolved for this review' : 'Mark resolved'}
            </Button>
            <p className="text-xs text-brand-muted">
              {resolved
                ? 'Will be saved with your verification. Editing the note requires resolving it again.'
                : 'Write at least 20 characters, then mark resolved.'}
            </p>
          </div>
        </>
      )}
    </section>
  );
}

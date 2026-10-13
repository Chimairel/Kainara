'use client';
import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import ConcernResolution from './ConcernResolution';
import ApprovalRecheckCanvas, { type ApprovalReviewTarget } from './ApprovalRecheckCanvas';
import type { DetailData } from './review-types';

export default function CaseFlagConcernSheet({
  concerns,
  canWrite,
  onUpdated,
}: {
  concerns: NonNullable<DetailData['flagConcerns']>;
  canWrite: boolean;
  onUpdated: () => Promise<void>;
}) {
  const [target, setTarget] = useState<ApprovalReviewTarget | null>(null);
  return (
    <div className="space-y-6">
      <p className="text-sm leading-6">
        Recorded flag concerns remain separate from the current member-case decision. Resolve active concerns before
        approving this meal.
      </p>
      {concerns.map((concern) => (
        <div key={concern.id} className="space-y-3">
          <ConcernResolution
            concern={concern}
            note=""
            resolved={false}
            canWrite={false}
            onNote={() => undefined}
            onResolve={() => undefined}
          />
          {!concern.active ? (
            <>
              <p className="text-sm font-bold text-brand-green">
                {concern.resolution
                  ? 'Resolved in the recorded review'
                  : 'Review closed; no individual resolution recorded.'}
              </p>
              {concern.resolution && <p className="whitespace-pre-wrap text-sm leading-6">{concern.resolution}</p>}
            </>
          ) : concern.kind === 'RECIPE' ? (
            <p className="text-sm">
              Recipe re-review is required.{' '}
              {concern.mealLibraryId && (
                <Link
                  className="font-semibold underline underline-offset-4"
                  href={`/nutritionist/library?mealId=${encodeURIComponent(concern.mealLibraryId)}`}
                >
                  Open recipe re-review canvas
                </Link>
              )}
            </p>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              disabled={!canWrite || !concern.mealLibraryId || !concern.approvalId}
              onClick={() =>
                setTarget({
                  mealLibraryId: concern.mealLibraryId!,
                  approvalId: concern.approvalId!,
                  kind: concern.kind as 'PROFILE' | 'CONDITION',
                })
              }
            >
              Resolve flagged case
            </Button>
          )}
        </div>
      ))}
      {target && <ApprovalRecheckCanvas target={target} onClose={() => setTarget(null)} onVerified={onUpdated} />}
    </div>
  );
}

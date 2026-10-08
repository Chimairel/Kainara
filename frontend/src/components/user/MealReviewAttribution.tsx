'use client';

import { ShieldCheck } from 'lucide-react';
import type { PublicVerifier } from '@/types';
import { maskPrcLicenseNumber } from './NutritionistCredentialCard';
import ReviewedByControl from './ReviewedByControl';

export default function MealReviewAttribution({
  verifier,
  nutritionistNote,
  onViewReviewer,
}: {
  verifier: PublicVerifier | null;
  nutritionistNote?: string | null;
  onViewReviewer: () => void;
}) {
  return (
    <section
      aria-label="Meal review attribution"
      className="rounded-2xl border border-brand-border bg-brand-bgAlt/50 p-4"
    >
      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-muted">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        {verifier ? 'Verified by' : 'RND review'}
      </h4>
      {verifier ? (
        <>
          <ReviewedByControl name={verifier.name} scope={verifier.reviewScope} onClick={onViewReviewer} />
          {(verifier.specialization || verifier.prcLicenseNumber) && (
            <p className="mt-1 break-words text-xs text-brand-muted">
              {[verifier.specialization, verifier.prcLicenseNumber && maskPrcLicenseNumber(verifier.prcLicenseNumber)]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
          {nutritionistNote && (
            <p className="mt-3 break-words text-xs text-brand-text">
              <span className="font-bold">RND note: </span>
              {nutritionistNote}
            </p>
          )}
        </>
      ) : (
        <p className="mt-2 text-xs text-brand-muted">No RND review recorded for this meal.</p>
      )}
    </section>
  );
}

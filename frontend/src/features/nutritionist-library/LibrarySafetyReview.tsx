'use client';

import { useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import { PrepareLibraryNutritionEvidence } from './PrepareLibraryNutritionEvidence';
import type { LibraryMeal } from './useNutritionistLibrary';

const allergens = ['SHELLFISH', 'NUTS', 'DAIRY', 'GLUTEN', 'EGGS'] as const;

export default function LibrarySafetyReview({ meal, refresh }: { meal: LibraryMeal; refresh: () => Promise<void> }) {
  const [prepare, setPrepare] = useState(false);
  const [facts, setFacts] = useState<Record<string, string>>({});
  const [crossContact, setCrossContact] = useState(false);
  const [usdaAccepted, setUsdaAccepted] = useState(false);
  const [rationale, setRationale] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const hasUsda = meal.ingredients?.some((item) => item.dataSource === 'USDA_FDC');
  const prepared = meal.preparedNutritionRevision === meal.safetyEvidenceRevision;
  const certify = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/nutritionist/library/${meal.id}/safety-evidence/certify`, {
        expectedRevision: meal.safetyEvidenceRevision,
        conditionDeclarationState: 'NOT_REVIEWED',
        allergenDeclarationState: 'REVIEWED_WITH_DECLARATIONS',
        crossContactAssessment: 'ASSESSED_NO_KNOWN_RISK',
        suitableConditions: [],
        allergensPresent: allergens.filter((key) => facts[key] === 'present'),
        allergensReviewedAbsent: allergens.filter((key) => facts[key] === 'absent'),
        usdaUseAccepted: Boolean(hasUsda && usdaAccepted),
        ...(hasUsda ? { usdaRationale: rationale } : {}),
      });
      await refresh();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'The evidence review could not be saved.'));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  if (meal.status !== 'APPROVED' || meal.safetyEvidenceStatus === 'COMPLETE') return null;
  return (
    <section
      aria-label="Reusable recipe evidence"
      className="rounded-2xl border border-brand-border bg-brand-surface p-5 space-y-4"
    >
      <h2 className="font-display text-xl font-bold">Review reusable recipe evidence</h2>
      <p className="text-sm text-brand-muted">
        Check measured nutrition and allergen facts for this serving. This review grants no health-condition clearance.
        Recipe authors must have another nutritionist perform the review.
      </p>
      {!prepared && (
        <Button variant="secondary" onClick={() => setPrepare(true)}>
          Prepare ingredient nutrition
        </Button>
      )}
      {prepare && <PrepareLibraryNutritionEvidence meal={meal} close={() => setPrepare(false)} refresh={refresh} />}
      {prepared && (
        <>
          <p className="text-xs text-brand-muted">Prepared basis: {meal.preparedNutritionBasis}</p>
          {meal.baseVerification !== 'VERIFIED' && (
            <p className="text-sm text-brand-muted">
              Complete independent base verification in Reviews before certifying this recipe.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {allergens.map((key) => (
              <label key={key} className="text-sm">
                {key.charAt(0) + key.slice(1).toLowerCase()}
                <select
                  aria-label={`${key} assessment`}
                  value={facts[key] ?? ''}
                  onChange={(event) => setFacts((old) => ({ ...old, [key]: event.target.value }))}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-2"
                >
                  <option value="">Not assessed</option>
                  <option value="present">Present</option>
                  <option value="absent">Reviewed absent</option>
                </select>
              </label>
            ))}
          </div>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={crossContact} onChange={(event) => setCrossContact(event.target.checked)} />
            I assessed cross-contact and found no known risk for this recorded preparation.
          </label>
          {hasUsda && (
            <>
              <label className="flex gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={usdaAccepted}
                  onChange={(event) => setUsdaAccepted(event.target.checked)}
                />
                I accept the identified USDA fallback records.
              </label>
              <label className="block text-sm">
                USDA acceptance rationale
                <textarea
                  value={rationale}
                  onChange={(event) => setRationale(event.target.value)}
                  maxLength={1000}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-2"
                />
              </label>
            </>
          )}
          <Button
            onClick={() => void certify()}
            isLoading={busy}
            disabled={
              meal.baseVerification !== 'VERIFIED' ||
              !crossContact ||
              allergens.some((key) => !facts[key]) ||
              Boolean(hasUsda && (!usdaAccepted || rationale.trim().length < 20))
            }
          >
            Certify this serving
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-status-error-text">
          {error}
        </p>
      )}
    </section>
  );
}

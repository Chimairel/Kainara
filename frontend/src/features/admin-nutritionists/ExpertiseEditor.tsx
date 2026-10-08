'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import { EXPERTISE_OPTIONS } from '@/features/nutritionist-reviews/review-routing';
import type { NutritionistRow } from './model';

export type ExpertiseDraft = { conditions: string[]; experienceYears: number | null; evidence: string };
export default function ExpertiseEditor({
  professional,
  busy,
  onSave,
}: {
  professional: NutritionistRow;
  busy: boolean;
  onSave: (draft: ExpertiseDraft) => Promise<void>;
}) {
  const [conditions, setConditions] = useState<string[]>(professional.verifiedExpertise ?? []);
  const [years, setYears] = useState(professional.verifiedExperienceYears?.toString() ?? '');
  const [evidence, setEvidence] = useState(professional.expertiseEvidence ?? '');
  const savedConditions = JSON.stringify(professional.verifiedExpertise ?? []);
  const savedYears = professional.verifiedExperienceYears;
  const savedEvidence = professional.expertiseEvidence;
  useEffect(() => {
    setConditions(JSON.parse(savedConditions));
    setYears(savedYears?.toString() ?? '');
    setEvidence(savedEvidence ?? '');
  }, [savedConditions, savedYears, savedEvidence]);
  return (
    <details className="mt-4 border-t border-brand-border pt-3">
      <summary className="cursor-pointer text-sm font-semibold">Verify review expertise</summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSave({ conditions, experienceYears: years === '' ? null : Number(years), evidence });
        }}
      >
        <p className="text-xs leading-relaxed text-brand-muted">
          Verify relevant qualifications and work history. These tags grant specialist priority; they do not replace RND
          eligibility or clinical approval. Verified years can grant experience priority when no specialist fully
          matches, even without condition tags.
        </p>
        <fieldset disabled={busy}>
          <legend className="text-xs font-bold">Verified expertise</legend>
          <div className="grid sm:grid-cols-2">
            {EXPERTISE_OPTIONS.map((option) => (
              <label key={option.code} className="flex min-h-11 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={conditions.includes(option.code)}
                  onChange={(event) =>
                    setConditions((current) =>
                      event.target.checked ? [...current, option.code] : current.filter((code) => code !== option.code)
                    )
                  }
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-xs font-bold">
          Verified years of experience
          <input
            type="number"
            min={0}
            max={70}
            step={1}
            required={conditions.length > 0}
            disabled={busy}
            value={years}
            onChange={(event) => setYears(event.target.value)}
            className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3"
          />
        </label>
        <label className="block text-xs font-bold">
          Verification evidence or revocation reason
          <textarea
            required
            minLength={10}
            maxLength={1500}
            disabled={busy}
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg p-3"
            rows={3}
          />
        </label>
        <p className="text-xs text-brand-muted">
          Record professional evidence references, not member health information. Clear tags to remove expertise
          priority; also clear verified years to remove experience priority.
        </p>
        <Button type="submit" size="sm" disabled={busy}>
          {busy ? 'Saving…' : 'Save verified expertise'}
        </Button>
      </form>
    </details>
  );
}

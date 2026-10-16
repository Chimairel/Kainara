'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Sparkles } from '@/components/ui/icons';
import type { useOutsideMealFormModel } from './useOutsideMealFormModel';
type SectionProps = { model: Pick<ReturnType<typeof useOutsideMealFormModel>, 'estimates' | 'handleSubmit' | 'props'> };

export default function OutsideMealConfirmationSection({ model }: SectionProps) {
  const { estimates, handleSubmit, props } = model;
  return (
    <section className="space-y-3 rounded-2xl bg-brand-bgAlt p-4" aria-labelledby="outside-ai-heading">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-brand-green" aria-hidden="true" />
        <div className="min-w-0">
          <h3 id="outside-ai-heading" className="font-display text-sm font-bold text-brand-text">
            No nutrition values? Ask for an estimate.
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-brand-muted">
            Gemini estimates unmatched foods from their names, portions and notes. It does not search the web or provide
            cited sources. Values remain provisional.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-brand-muted">
          {estimates ? (
            <>
              <strong className="font-semibold text-brand-text">
                {estimates.remaining} of {estimates.cap}
              </strong>{' '}
              outside-food estimates left this week.{' '}
              <Link href="/membership" className="font-semibold text-brand-green underline underline-offset-4">
                Plan allowance
              </Link>
            </>
          ) : (
            'Outside-food estimates have a separate allowance from Nara chat.'
          )}
        </p>
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleSubmit(true)}
          disabled={props.isLoading || !props.mealName.trim() || estimates?.remaining === 0}
          className="min-h-11 w-full gap-2 text-sm sm:w-auto"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" /> Get AI estimate
        </Button>
      </div>
      {estimates?.remaining === 0 && (
        <p className="text-xs text-brand-muted">
          Your AI estimate allowance is used up. You can still enter label values or use a saved reference.
        </p>
      )}
    </section>
  );
}

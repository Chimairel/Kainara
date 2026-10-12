'use client';

export interface OnboardingProgressSliderProps {
  currentStep: number;
  totalSteps?: number;
  className?: string;
}
const STEP_LABELS = ['Body & goals', 'Food preferences', 'Conditions', 'Food safety', 'Shopping day', 'Review & terms'];

export default function OnboardingProgressSlider({
  currentStep,
  totalSteps = 6,
  className = '',
}: OnboardingProgressSliderProps) {
  const count = Math.max(1, Math.floor(totalSteps));
  const step = Math.min(Math.max(currentStep, 1), count);
  const percentage = Math.round((step / count) * 100);
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between gap-3 text-xs text-brand-muted">
        <span>
          Step {step} of {count}
        </span>
        <span className="tabular-nums">{percentage}% Completed</span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={count}
        aria-label={`Onboarding progress: Step ${step} of ${count}`}
      >
        <ol className="flex gap-2" aria-hidden="true">
          {Array.from({ length: count }, (_, i) => (
            <li key={i} className="min-w-0 flex-1">
              <div className={`h-1.5 rounded-full ${i + 1 <= step ? 'bg-brand-accent' : 'bg-brand-border'}`} />
              <span
                className={`mt-2 hidden text-xs sm:block ${i + 1 === step ? 'font-semibold text-brand-text' : 'text-brand-muted'}`}
              >
                {STEP_LABELS[i] ?? `Step ${i + 1}`}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

import { ArrowLeft, ArrowRight, Check, CheckCircle2, ClipboardCheck } from 'lucide-react';
import Button from '@/components/ui/Button';

import { steps, stepDescriptions, Props } from './steps/application-fields';
import { IdentityFields } from './steps/IdentityFields';
import { CredentialFields } from './steps/CredentialFields';
import { ExperienceFields } from './steps/ExperienceFields';
import { AvailabilityFields } from './steps/AvailabilityFields';
import { ApplicationReview } from './steps/ApplicationReview';
export function ApplicationWizard(props: Props) {
  const { error, errors, form, isLoading, onBack, onContinue, onFieldChange, onSubmit, step } = props;

  return (
    <div className="surface-panel relative overflow-hidden rounded-[30px] p-6 sm:p-9 shadow-xl border border-brand-border">
      {/* Step Progress Tracker */}
      <div className="mb-8">
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const isCompleted = index < step;
            const isCurrent = index === step;

            return (
              <div key={item.label} className="flex flex-col items-center text-center">
                <div className="relative flex w-full items-center justify-center">
                  {/* Track bar */}
                  <div
                    className={`h-1.5 w-full rounded-full transition-all duration-500 ${
                      isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-brand-accent' : 'bg-brand-border/60'
                    }`}
                  />
                </div>

                <div
                  className={`mt-2.5 hidden sm:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                    isCompleted ? 'text-emerald-500' : isCurrent ? 'text-brand-accent' : 'text-brand-muted/70'
                  }`}
                >
                  {isCompleted ? <Check className="h-3 w-3 stroke-[3]" /> : <Icon className="h-3 w-3" />}
                  <span>{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-brand-border/60 pb-5">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Step {step + 1} of 5
          </span>
          <h2 className="mt-2 font-display text-2xl font-black sm:text-3xl text-brand-text">
            {stepDescriptions[step].title}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-brand-muted">{stepDescriptions[step].subtitle}</p>
        </div>
      </div>

      {/* Global Form Error Banner */}
      {error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-status-error-text/30 bg-status-error-bg/15 p-4 text-xs font-semibold text-status-error-text"
        >
          <div className="mt-0.5 rounded-full bg-status-error-text/20 p-1">
            <CheckCircle2 className="h-3.5 w-3.5 rotate-45" />
          </div>
          <div className="flex-1 leading-5">{error}</div>
        </div>
      )}

      {/* Step Form Content */}
      <div className="mt-7 space-y-6">
        {step === 0 && (
          <>
            <IdentityFields form={form} errors={errors} onFieldChange={onFieldChange} />
            {props.emailVerification}
          </>
        )}
        {step === 1 && (
          <CredentialFields form={form} errors={errors} onFieldChange={onFieldChange} licenseHint={props.licenseHint} />
        )}
        {step === 2 && <ExperienceFields form={form} errors={errors} onFieldChange={onFieldChange} />}
        {step === 3 && <AvailabilityFields form={form} errors={errors} onFieldChange={onFieldChange} />}
        {step === 4 && <ApplicationReview form={form} />}
      </div>

      {/* Wizard Navigation Footer */}
      <div className="mt-10 flex items-center justify-between gap-3 border-t border-brand-border/60 pt-6">
        <Button type="button" variant="secondary" disabled={step === 0 || isLoading} onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {step < 4 ? (
          <Button type="button" onClick={onContinue} className="gap-2">
            Continue to {steps[step + 1].label}
            <ArrowRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onSubmit}
            isLoading={isLoading}
            className="gap-2 bg-brand-accent hover:brightness-110 text-white shadow-lg shadow-brand-accent/25"
          >
            <ClipboardCheck className="h-4 w-4" />
            Submit Application
          </Button>
        )}
      </div>
    </div>
  );
}

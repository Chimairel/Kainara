import type { FormEvent } from 'react';
import { Search, CheckCircle2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Props = {
  email: string;
  error: string | null;
  isLoading: boolean;
  onEmailChange: (value: string) => void;
  onReferenceChange: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
  referenceCode: string;
};

export function ApplicationTrackingForm(props: Props) {
  return (
    <form
      onSubmit={props.onSubmit}
      className="surface-panel relative overflow-hidden rounded-[30px] p-6 sm:p-9 shadow-xl border border-brand-border"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-brand-cyan animate-pulse" />
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-cyan">
          Official Applicant Portal
        </span>
      </div>

      <h2 className="mt-2 font-display text-2xl sm:text-3xl font-black text-brand-text">Track your application</h2>
      <p className="mt-1.5 text-xs sm:text-sm text-brand-muted leading-6">
        Enter the application reference code generated at submission alongside your registered professional email.
      </p>

      {props.error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-2xl border border-status-error-text/30 bg-status-error-bg/15 p-4 text-xs font-semibold text-status-error-text"
        >
          <div className="mt-0.5 rounded-full bg-status-error-text/20 p-1">
            <CheckCircle2 className="h-3.5 w-3.5 rotate-45" />
          </div>
          <div className="flex-1 leading-5">{props.error}</div>
        </div>
      )}

      <div className="mt-7 space-y-4">
        <div>
          <Input
            id="tracking-reference"
            label="Application Reference Code"
            value={props.referenceCode}
            onChange={(event) => props.onReferenceChange(event.target.value.toUpperCase())}
            placeholder="e.g. NM-XXXXXXXXXXXX"
            helperText="Use the complete NM- reference code received upon submission."
            required
          />
        </div>

        <div>
          <Input
            id="tracking-email"
            label="Registered Professional Email"
            type="email"
            value={props.email}
            onChange={(event) => props.onEmailChange(event.target.value)}
            placeholder="e.g. professional@example.com"
            helperText="The email address provided in your application."
            autoComplete="email"
            required
          />
        </div>

        <Button
          type="submit"
          size="lg"
          isLoading={props.isLoading}
          className="w-full mt-2 gap-2 bg-brand-accent hover:brightness-110 text-white shadow-lg shadow-brand-accent/25"
        >
          <Search className="h-4 w-4" />
          Check Application Status
        </Button>
      </div>

      {/* Status Stages Guide */}
      <div className="mt-8 rounded-2xl border border-brand-border/80 bg-brand-surface/50 p-4 sm:p-5">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-muted">
          What happens after you submit?
        </p>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2 text-xs">
          <div className="flex items-start gap-2.5 text-brand-muted">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[9px] font-bold text-emerald-400">
              1
            </span>
            <span>Administrator review of submitted PRC license details</span>
          </div>
          <div className="flex items-start gap-2.5 text-brand-muted">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-[9px] font-bold text-cyan-400">
              2
            </span>
            <span>Schedule a direct online identity verification call</span>
          </div>
          <div className="flex items-start gap-2.5 text-brand-muted">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-[9px] font-bold text-amber-400">
              3
            </span>
            <span>Identity and attestation photo match</span>
          </div>
          <div className="flex items-start gap-2.5 text-brand-muted">
            <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-brand-accent/20 text-[9px] font-bold text-brand-accent">
              4
            </span>
            <span>Private nutritionist workspace account activation</span>
          </div>
        </div>
      </div>
    </form>
  );
}

import { Video } from 'lucide-react';

import Input from '@/components/ui/Input';

import { FieldProps } from './application-fields';
export function AvailabilityFields({ form, errors, onFieldChange }: FieldProps) {
  return (
    <>
      <div className="rounded-2xl border border-brand-cyan/25 bg-brand-cyan/[0.06] p-4 text-xs leading-5 text-brand-muted">
        <div className="flex items-center gap-2 font-bold text-brand-text">
          <Video className="h-4 w-4 text-brand-cyan" />
          Direct Verification Video Call
        </div>
        <p className="mt-1">
          Provide at least two independent dates/times when you are available for a short Google Meet call. An
          administrator will confirm one slot and send the invite link to your email.
        </p>
      </div>

      <div className="space-y-4">
        {(['callSlotOne', 'callSlotTwo', 'callSlotThree'] as const).map((field, index) => (
          <div key={field} className="rounded-2xl border border-brand-border bg-brand-surface/40 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-accent">
                Option 0{index + 1} {index === 2 && '(Optional)'}
              </span>
              <span className="text-[10px] text-brand-muted">
                {['Primary choice', 'Alternative backup', 'Flexible option'][index]}
              </span>
            </div>
            <Input
              id={field}
              label={['Preferred schedule', 'Second schedule option', 'Third schedule option'][index]}
              type="datetime-local"
              value={form[field]}
              onChange={(event) => onFieldChange(field, event.target.value)}
              error={errors[field]}
            />
          </div>
        ))}
      </div>

      <div
        className={`rounded-2xl border p-4 transition ${
          errors.consent
            ? 'border-status-error-text/50 bg-status-error-bg/10'
            : 'border-brand-border bg-brand-surface/40'
        }`}
      >
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={form.consent}
            onChange={(event) => onFieldChange('consent', event.target.checked)}
            className="mt-1 h-4 w-4 rounded accent-emerald-500"
          />
          <span className="text-xs leading-5 text-brand-muted">
            <strong className="text-brand-text">Professional Declaration & Consent:</strong> I certify that all
            information, PRC license records, and educational credentials provided are true and accurate. I consent to
            credential review and an online identity verification call.
          </span>
        </label>
        {errors.consent && <p className="mt-2 text-xs font-semibold text-status-error-text">{errors.consent}</p>}
      </div>
    </>
  );
}

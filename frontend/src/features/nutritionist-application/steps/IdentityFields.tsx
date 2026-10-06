import Input from '@/components/ui/Input';

import { PhotoUpload } from '../PhotoUpload';
import { FieldProps } from './application-fields';
export function IdentityFields({ form, errors, onFieldChange }: FieldProps) {
  return (
    <>
      <div className="space-y-4">
        <Input
          id="fullName"
          label="Full professional name"
          value={form.fullName}
          onChange={(event) => onFieldChange('fullName', event.target.value)}
          error={errors.fullName}
          placeholder="e.g. Maria Clara Santos"
          helperText="Complete legal name exactly as printed on your PRC identification card."
          autoComplete="name"
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            id="applicationEmail"
            label="Professional email"
            type="email"
            value={form.email}
            onChange={(event) => onFieldChange('email', event.target.value)}
            error={errors.email}
            placeholder="e.g. maria.santos@gmail.com"
            helperText="Where verification meeting links and access tokens will be delivered."
            autoComplete="email"
            required
          />
          <Input
            id="phoneNumber"
            label="Philippine contact number"
            type="tel"
            value={form.phoneNumber}
            onChange={(event) => onFieldChange('phoneNumber', event.target.value)}
            error={errors.phoneNumber}
            placeholder="09XX XXX XXXX or +63 9XX XXX XXXX"
            helperText="Direct mobile line for verification coordination."
            autoComplete="tel"
            required
          />
        </div>
      </div>

      <div className="pt-2">
        <PhotoUpload
          value={form.officialHeadshot}
          onChange={(val) => onFieldChange('officialHeadshot', val)}
          error={errors.officialHeadshot}
        />

        <div
          className={`mt-4 rounded-2xl border p-4 transition ${
            errors.photoRecentAttested
              ? 'border-status-error-text/50 bg-status-error-bg/10'
              : 'border-brand-border bg-brand-surface/40 hover:bg-brand-surface/70'
          }`}
        >
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={form.photoRecentAttested}
              onChange={(event) => onFieldChange('photoRecentAttested', event.target.checked)}
              className="mt-1 h-4 w-4 rounded accent-emerald-500"
            />
            <span className="text-xs leading-5 text-brand-muted">
              <strong className="text-brand-text">30-Day Photo Attestation:</strong> I attest that this photo was taken
              within the past 30 days and accurately represents my current appearance. I understand an administrator
              will compare it with my live video during the 1-on-1 verification call.
            </span>
          </label>
          {errors.photoRecentAttested && (
            <p role="alert" className="mt-2 text-xs font-semibold text-status-error-text">
              {errors.photoRecentAttested}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

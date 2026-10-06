import Input from '@/components/ui/Input';

import { quickSpecializations, FieldProps } from './application-fields';
export function CredentialFields({ form, errors, onFieldChange, licenseHint }: FieldProps & { licenseHint?: string }) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="prcLicenseNumber"
          label="PRC license registration number"
          value={form.prcLicenseNumber}
          onChange={(event) => onFieldChange('prcLicenseNumber', event.target.value.toUpperCase())}
          error={errors.prcLicenseNumber}
          placeholder="e.g. 0012345 or RND-0012345"
          helperText={licenseHint || 'Enter the registration number shown on your PRC identification card.'}
          required
        />
        <Input
          id="prcLicenseExpiry"
          label="Card validity / expiration date"
          type="date"
          value={form.prcLicenseExpiry}
          onChange={(event) => onFieldChange('prcLicenseExpiry', event.target.value)}
          error={errors.prcLicenseExpiry}
          helperText="Must be unexpired on the date of review."
          required
        />
      </div>

      <div>
        <Input
          id="specialization"
          label="Primary specialization / clinical focus"
          value={form.specialization}
          onChange={(event) => onFieldChange('specialization', event.target.value)}
          error={errors.specialization}
          placeholder="e.g. Clinical Nutrition, Renal Nutrition, Diabetes Care"
          helperText="Your core domain of dietetic practice and clinical reviews."
          required
        />

        {/* Quick-Pick Specialization Chips */}
        <div className="mt-2.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Quick suggestions:</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {quickSpecializations.map((spec) => (
              <button
                key={spec}
                type="button"
                onClick={() => onFieldChange('specialization', spec)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  form.specialization === spec
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold'
                    : 'border-brand-border bg-brand-surface/60 text-brand-muted hover:border-brand-accent/50 hover:text-brand-text'
                }`}
              >
                {spec}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

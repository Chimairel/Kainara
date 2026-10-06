import Input from '@/components/ui/Input';

import { quickUniversities, FieldProps } from './application-fields';
export function ExperienceFields({ form, errors, onFieldChange }: FieldProps) {
  const bioLength = form.professionalBio.length;
  const isBioValid = bioLength >= 40;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Input
            id="yearsOfExperience"
            label="Years in practice as an RND"
            type="number"
            min="0"
            max="70"
            value={form.yearsOfExperience}
            onChange={(event) => onFieldChange('yearsOfExperience', event.target.value)}
            error={errors.yearsOfExperience}
            placeholder="e.g. 5"
            helperText="Total years practicing post-licensure."
            required
          />
          <div className="mt-2 flex gap-1.5">
            {['1', '3', '5', '8', '12+'].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => onFieldChange('yearsOfExperience', yr.replace('+', ''))}
                className="rounded-md border border-brand-border/80 bg-brand-surface/60 px-2 py-0.5 text-[10px] font-semibold text-brand-muted hover:text-brand-text hover:border-brand-accent"
              >
                {yr} {yr === '1' ? 'yr' : 'yrs'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Input
            id="university"
            label="Degree institution / university"
            value={form.university}
            onChange={(event) => onFieldChange('university', event.target.value)}
            error={errors.university}
            placeholder="e.g. UP Los Baños"
            helperText="Where you earned your BS Nutrition & Dietetics."
            required
          />
        </div>
      </div>

      {/* University quick chips */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-muted">Common institutions:</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {quickUniversities.map((uni) => (
            <button
              key={uni}
              type="button"
              onClick={() => onFieldChange('university', uni)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                form.university === uni
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400 font-bold'
                  : 'border-brand-border bg-brand-surface/60 text-brand-muted hover:border-brand-accent/50 hover:text-brand-text'
              }`}
            >
              {uni}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="professionalBio" className="font-display text-xs font-bold text-brand-text/90">
            Professional background & practice profile <span className="text-brand-accent">*</span>
          </label>
          <span className={`font-mono text-[10px] font-bold ${isBioValid ? 'text-emerald-500' : 'text-amber-400'}`}>
            {bioLength}/2000 chars {isBioValid ? '✓' : '(min 40)'}
          </span>
        </div>
        <textarea
          id="professionalBio"
          rows={5}
          maxLength={2000}
          value={form.professionalBio}
          onChange={(event) => onFieldChange('professionalBio', event.target.value)}
          className={`mt-2 w-full rounded-2xl border bg-brand-surface/75 px-4 py-3 text-sm text-brand-text outline-none transition focus:ring-4 ${
            errors.professionalBio
              ? 'border-status-error-text focus:ring-status-error-text/20'
              : 'border-brand-border focus:border-brand-accent focus:ring-brand-accent/10'
          }`}
          placeholder="Detail your clinical hospital experience, private consultations, community nutrition projects, or specialties. (Minimum 40 characters)"
        />
        {errors.professionalBio && (
          <p className="mt-2 text-xs font-semibold text-status-error-text">{errors.professionalBio}</p>
        )}
      </div>
    </>
  );
}

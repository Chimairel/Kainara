import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  BadgeCheck,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  ShieldCheck,
  UserRound,
  Video,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import type { NutritionistApplicationForm } from '@/validation/nutritionist-application.schemas';
import { PhotoUpload } from './PhotoUpload';

const steps = [
  { label: 'Identity', icon: UserRound },
  { label: 'Credentials', icon: BadgeCheck },
  { label: 'Experience', icon: FileCheck2 },
  { label: 'Availability', icon: Video },
  { label: 'Review', icon: ClipboardCheck },
];

const stepDescriptions = [
  {
    title: 'Your professional identity',
    subtitle: 'Provide your legal name and contact details as registered with the Professional Regulation Commission.',
  },
  {
    title: 'PRC credentials and licensure',
    subtitle:
      'Enter your license information. KAINARA checks for duplicates; an administrator verifies your credentials.',
  },
  {
    title: 'Practice experience & background',
    subtitle: 'Share your clinical background, alma mater, and years in dietetic practice.',
  },
  {
    title: 'Verification call availability (Philippine time)',
    subtitle: 'Select at least two schedules for an identity verification call with a KAINARA administrator.',
  },
  {
    title: 'Review your application',
    subtitle: 'Verify your submitted credentials before final transmission to the clinical review desk.',
  },
];

const quickSpecializations = [
  'Clinical Nutrition',
  'Renal Nutrition',
  'Diabetes Care & Education',
  'Pediatric Nutrition',
  'Public Health & Community',
  'Sports Nutrition',
  'Bariatric & Weight Management',
];

const quickUniversities = [
  'UP Los Baños (UPLB)',
  'University of Santo Tomas (UST)',
  'UP Diliman',
  'Philippine Women’s University',
  'University of San Carlos (USC)',
  'Manila Central University (MCU)',
];

type Props = {
  emailVerification?: ReactNode;
  licenseHint?: string;
  error: string | null;
  errors: Record<string, string>;
  form: NutritionistApplicationForm;
  isLoading: boolean;
  onBack: () => void;
  onContinue: () => void;
  onFieldChange: (field: keyof NutritionistApplicationForm, value: string | boolean) => void;
  onSubmit: () => void;
  step: number;
};

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

type FieldProps = Pick<Props, 'errors' | 'form' | 'onFieldChange'>;

function IdentityFields({ form, errors, onFieldChange }: FieldProps) {
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

function CredentialFields({ form, errors, onFieldChange, licenseHint }: FieldProps & { licenseHint?: string }) {
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

function ExperienceFields({ form, errors, onFieldChange }: FieldProps) {
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

function AvailabilityFields({ form, errors, onFieldChange }: FieldProps) {
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

function ApplicationReview({ form }: { form: NutritionistApplicationForm }) {
  const summary = [
    ['Full Professional Name', form.fullName || 'Not provided'],
    ['Contact Email', form.email || 'Not provided'],
    ['Mobile Number', form.phoneNumber || 'Not provided'],
    ['PRC Registration No.', form.prcLicenseNumber || 'Not provided'],
    ['License Expiration', form.prcLicenseExpiry || 'Not provided'],
    ['Primary Specialization', form.specialization || 'Clinical Nutrition'],
    ['Clinical Experience', `${form.yearsOfExperience || '0'} year(s)`],
    ['Degree Institution', form.university || 'Not provided'],
  ];

  return (
    <div className="space-y-6">
      {/* Digital RND Applicant Credential Card Preview */}
      <div className="relative overflow-hidden rounded-[26px] border border-[#1b4e41] bg-gradient-to-br from-[#0c2720] via-[#081f19] to-[#041511] p-6 text-white shadow-xl">
        {/* Subtle Watermark Corner Motif */}
        <div className="pointer-events-none absolute -right-6 -bottom-6 opacity-10">
          <Award className="h-44 w-44 text-emerald-300" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                KAINARA CLINICAL NETWORK
              </span>
            </div>
            <span className="rounded-full border border-emerald-400/30 bg-emerald-950/60 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-200">
              PRC-RND CANDIDATE
            </span>
          </div>

          <div className="mt-5 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {form.officialHeadshot ? (
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-emerald-400/60 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.officialHeadshot} alt={form.fullName} className="h-full w-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-emerald-950/90 py-0.5 text-center font-mono text-[8px] font-bold text-emerald-200 uppercase tracking-wider">
                  Applicant photo
                </span>
              </div>
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-white/20 bg-white/5 text-xs text-white/50">
                No Photo
              </div>
            )}

            <div className="flex-1 text-center sm:text-left min-w-0">
              <h3 className="font-display text-xl font-black text-white truncate">
                {form.fullName || 'Applicant Name'}, RND
              </h3>
              <p className="mt-0.5 font-mono text-xs font-semibold text-[#f09e6c]">
                PRC REG: {form.prcLicenseNumber || 'PENDING'}
              </p>
              <div className="mt-3 flex flex-wrap justify-center sm:justify-start gap-1.5">
                <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white">
                  {form.specialization || 'Clinical Nutrition'}
                </span>
                <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                  {form.yearsOfExperience ? `${form.yearsOfExperience} yrs experience` : 'Experience pending'}
                </span>
                <span className="rounded-md border border-white/15 bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/80">
                  {form.university || 'University'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Table */}
      <div className="rounded-2xl border border-brand-border bg-brand-surface/40 overflow-hidden divide-y divide-brand-border/60">
        {summary.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-xs">
            <span className="text-brand-muted font-medium">{label}</span>
            <strong className="text-brand-text text-right truncate max-w-[65%]">{value}</strong>
          </div>
        ))}
      </div>

      {/* Bio excerpt */}
      <div className="rounded-2xl border border-brand-border bg-brand-surface/40 p-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-muted">
          Professional Bio Statement
        </p>
        <p className="mt-2 text-xs leading-5 text-brand-text whitespace-pre-wrap">
          {form.professionalBio || 'No background statement provided.'}
        </p>
      </div>

      {/* Verification Notice */}
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] p-4 text-xs leading-5 text-brand-muted">
        <div className="flex items-center gap-2 font-bold text-emerald-400">
          <ShieldCheck className="h-4 w-4" />
          Submission Confirmation
        </div>
        <p className="mt-1">
          Submitting stores your application in the administrative queue and generates your tracking reference. Approval
          and a verification call are required before you receive workspace access. Save your reference code to track
          progress; submission does not create a privileged account.
        </p>
      </div>
    </div>
  );
}

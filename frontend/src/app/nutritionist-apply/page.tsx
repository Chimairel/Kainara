'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useLicenseAvailability } from '@/features/nutritionist-application/useLicenseAvailability';
import { ArrowLeft, Search, UserPlus } from 'lucide-react';
import { getApiErrorMessage } from '@/lib/api-error';
import PublicHeader from '@/components/shared/PublicHeader';
import PublicFooter from '@/components/shared/PublicFooter';
import api from '@/lib/axios';
import { ApplicationSidebar } from '@/features/nutritionist-application/ApplicationSidebar';
import { ApplicationStatusCard } from '@/features/nutritionist-application/ApplicationStatusCard';
import { ApplicationTrackingForm } from '@/features/nutritionist-application/ApplicationTrackingForm';
import ApplicantEmailVerification from '@/features/nutritionist-application/ApplicantEmailVerification';
import { ApplicationWizard } from '@/features/nutritionist-application/ApplicationWizard';
import { initialApplicationForm, type PublicApplication } from '@/features/nutritionist-application/model';
import {
  applicantAvailabilitySchema,
  applicantCredentialSchema,
  applicantIdentitySchema,
  applicantProfileSchema,
  issuesToFields,
  type NutritionistApplicationForm,
} from '@/validation/nutritionist-application.schemas';

export default function NutritionistApplyPage() {
  const [mode, setMode] = useState<'apply' | 'track'>('apply');
  const [step, setStep] = useState(0);
  const [emailProof, setEmailProof] = useState<{ email: string; proof: string } | null>(null);
  const [form, setForm] = useState(initialApplicationForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [application, setApplication] = useState<PublicApplication | null>(null);
  const [trackingReference, setTrackingReference] = useState('');
  const [trackingEmail, setTrackingEmail] = useState('');

  const [refreshWarning, setRefreshWarning] = useState(false);
  const licenseState = useLicenseAvailability(form.prcLicenseNumber, mode === 'apply' && !application);
  const licenseError =
    licenseState === 'taken' ? 'This PRC number already has a pending/approved application or registered account.' : '';
  const licenseHint =
    licenseState === 'checking'
      ? 'Checking for an existing KAINARA application…'
      : licenseState === 'available'
        ? 'No active application found. An administrator must still verify your PRC credentials.'
        : licenseState === 'unavailable'
          ? 'Availability check unavailable. Your license will be checked when you submit.'
          : undefined;
  const referenceCode = application?.referenceCode;
  const applicantEmail = application?.email;
  useVisiblePolling(
    async (signal) => {
      try {
        const response = await api.post(
          '/nutritionist-applications/status',
          { referenceCode, email: applicantEmail },
          { signal }
        );
        if (!signal.aborted) {
          setApplication(response.data.data);
          setRefreshWarning(false);
        }
      } catch {
        if (!signal.aborted) setRefreshWarning(true);
      }
    },
    {
      enabled: Boolean(application && !['REJECTED', 'ACTIVATED'].includes(application.status)),
      immediate: false,
      scopeKey: `${referenceCode}:${applicantEmail}`,
    }
  );

  useEffect(() => {
    if (window.location.hash === '#track') setMode('track');
  }, []);

  const stepValidation = useMemo(
    () => [
      () => applicantIdentitySchema.safeParse(form),
      () => applicantCredentialSchema.safeParse(form),
      () => applicantProfileSchema.safeParse(form),
      () => applicantAvailabilitySchema.safeParse(form),
    ],
    [form]
  );

  const setField = (field: keyof NutritionistApplicationForm, value: string | boolean) => {
    if (field === 'email') setEmailProof(null);
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: '' }));
  };

  const nextStep = () => {
    setError(null);
    const result = step < 4 ? stepValidation[step]?.() : undefined;
    if (result && !result.success) {
      setErrors(issuesToFields(result.error));
      setError('Please correct the highlighted fields before continuing.');
      return;
    }
    if (step === 0 && emailProof?.email !== form.email.trim().toLowerCase()) {
      setError('Verify your email address before continuing.');
      return;
    }
    if (step === 1 && licenseError) {
      setErrors({ prcLicenseNumber: licenseError });
      return;
    }
    if (step === 1 && licenseState === 'checking') {
      setError('Please wait for the license availability check.');
      return;
    }
    setErrors({});
    setStep((current) => Math.min(4, current + 1));
  };

  const submitApplication = async () => {
    if (isLoading) return;
    if (!emailProof || emailProof.email !== form.email.trim().toLowerCase()) {
      setError('Verify your email address first.');
      setStep(0);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const availableCallSlots = [form.callSlotOne, form.callSlotTwo, form.callSlotThree]
        .filter(Boolean)
        .map((value) => new Date(`${value}:00+08:00`).toISOString());
      const response = await api.post('/nutritionist-applications', {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        emailVerificationProof: emailProof.proof,
        phoneNumber: form.phoneNumber.trim(),
        officialHeadshot: form.officialHeadshot || undefined,
        photoRecentAttested: form.photoRecentAttested,
        prcLicenseNumber: form.prcLicenseNumber.trim(),
        prcLicenseExpiry: new Date(`${form.prcLicenseExpiry}T23:59:59+08:00`).toISOString(),
        specialization: form.specialization.trim(),
        yearsOfExperience: Number(form.yearsOfExperience),
        university: form.university.trim(),
        professionalBio: form.professionalBio.trim(),
        availableCallSlots,
        consent: true,
      });
      setApplication(response.data.data);
      setTrackingReference(response.data.data.referenceCode);
      setTrackingEmail(response.data.data.email);
    } catch (caught) {
      if (
        (caught as { response?: { data?: { errorCode?: string } } }).response?.data?.errorCode ===
        'APPLICANT_EMAIL_UNVERIFIED'
      ) {
        setEmailProof(null);
        setStep(0);
      }
      setError(getApplicationError(caught, 'Application could not be submitted.'));
    } finally {
      setIsLoading(false);
    }
  };

  const lookupStatus = async (event: FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post('/nutritionist-applications/status', {
        referenceCode: trackingReference,
        email: trackingEmail,
      });
      setApplication(response.data.data);
    } catch (caught) {
      setError(getApplicationError(caught, 'Application was not found.'));
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (nextMode: 'apply' | 'track') => {
    setMode(nextMode);
    setApplication(null);
    setRefreshWarning(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-brand-bg text-brand-text flex flex-col justify-between">
      <div>
        <PublicHeader />

        <main className="mx-auto max-w-[1320px] px-5 py-6 sm:px-8 lg:px-12 lg:py-12">
          {/* Back breadcrumb */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs font-bold text-brand-muted hover:text-brand-text transition group"
            >
              <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
              Return to KAINARA Platform
            </Link>
          </div>

          <div className="grid gap-6 lg:gap-10 lg:grid-cols-[0.8fr_1.2fr] items-start">
            <ApplicationSidebar />

            <section>
              <ModeSelector mode={mode} onChange={switchMode} />
              {application ? (
                <>
                  <ApplicationStatusCard application={application} />
                  <p role="status" className="mt-3 text-xs text-brand-muted">
                    {refreshWarning
                      ? 'Updates paused. Retrying automatically when this page is active.'
                      : !['REJECTED', 'ACTIVATED'].includes(application.status)
                        ? 'Application updates automatically while this page is open.'
                        : ''}
                  </p>
                  {application.status === 'REJECTED' && (
                    <button
                      type="button"
                      className="mt-3 text-sm font-bold text-brand-green underline"
                      onClick={() => {
                        setForm({
                          ...initialApplicationForm,
                          email: application.email,
                          fullName: application.fullName,
                        });
                        setStep(0);
                        setErrors({});
                        switchMode('apply');
                      }}
                    >
                      Apply again
                    </button>
                  )}
                </>
              ) : mode === 'track' ? (
                <ApplicationTrackingForm
                  email={trackingEmail}
                  error={error}
                  isLoading={isLoading}
                  onEmailChange={setTrackingEmail}
                  onReferenceChange={setTrackingReference}
                  onSubmit={lookupStatus}
                  referenceCode={trackingReference}
                />
              ) : (
                <ApplicationWizard
                  error={error}
                  errors={{ ...errors, ...(licenseError ? { prcLicenseNumber: licenseError } : {}) }}
                  emailVerification={
                    <ApplicantEmailVerification
                      email={form.email}
                      verified={emailProof?.email === form.email.trim().toLowerCase()}
                      onVerified={(email, proof) => setEmailProof({ email, proof })}
                    />
                  }
                  licenseHint={licenseHint}
                  form={form}
                  isLoading={isLoading}
                  onBack={() => {
                    setStep((current) => Math.max(0, current - 1));
                    setError(null);
                  }}
                  onContinue={nextStep}
                  onFieldChange={setField}
                  onSubmit={submitApplication}
                  step={step}
                />
              )}
            </section>
          </div>
        </main>
      </div>

      <PublicFooter />
    </div>
  );
}

function ModeSelector({ mode, onChange }: { mode: 'apply' | 'track'; onChange: (mode: 'apply' | 'track') => void }) {
  return (
    <div className="mb-6 flex rounded-2xl border border-brand-border bg-brand-surface/60 p-1.5 shadow-sm backdrop-blur-sm">
      <button
        type="button"
        onClick={() => onChange('apply')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition duration-200 ${
          mode === 'apply'
            ? 'bg-brand-accent text-white shadow-md shadow-brand-accent/20'
            : 'text-brand-muted hover:text-brand-text'
        }`}
      >
        <UserPlus className="h-4 w-4" />
        Apply Online
      </button>
      <button
        type="button"
        onClick={() => onChange('track')}
        className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition duration-200 ${
          mode === 'track'
            ? 'bg-brand-accent text-white shadow-md shadow-brand-accent/20'
            : 'text-brand-muted hover:text-brand-text'
        }`}
      >
        <Search className="h-4 w-4" />
        Track Application
      </button>
    </div>
  );
}

function getApplicationError(caught: unknown, fallback: string) {
  return getApiErrorMessage(caught, fallback);
}

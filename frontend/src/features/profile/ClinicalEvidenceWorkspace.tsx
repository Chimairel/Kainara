'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { invalidateSessionResource } from '@/lib/session-resource-cache';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { getApiErrorMessage } from '@/lib/api-error';
import OnboardingProgressSlider from '@/components/onboarding/OnboardingProgressSlider';
import PersonalizationTabs from '@/components/user/PersonalizationTabs';

type Answers = {
  conditionDetails: string;
  medications: string;
  dietaryAdvice: string;
  recentSymptoms: string;
  measurements: string;
};
type Workspace = {
  safetyRevision: number;
  availableAreas: string[];
  contexts: Array<{ area: string; responses: Partial<Answers> }>;
  requirements: Array<{ area: string; state: string; message: string }>;
};
const empty: Answers = {
  conditionDetails: '',
  medications: '',
  dietaryAdvice: '',
  recentSymptoms: '',
  measurements: '',
};
const fields: Array<[keyof Answers, string]> = [
  ['conditionDetails', 'Condition or restriction details'],
  ['medications', 'Current medication or supplements'],
  ['dietaryAdvice', 'Dietary advice you have received'],
  ['recentSymptoms', 'Recent symptoms or episodes'],
  ['measurements', 'Recent measurements or lab values (optional)'],
];
const friendly = (value: string) => value.replace(/_/g, ' ').toLowerCase();
export default function ClinicalEvidenceWorkspace({ mode = 'profile' }: { mode?: 'profile' | 'onboarding' }) {
  const ownerId = useAuth().user?.userId;
  const router = useRouter();
  const params = useSearchParams();
  const endpoint = mode === 'onboarding' ? '/user/onboarding/clinical-evidence' : '/user/clinical-evidence';
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [area, setArea] = useState('');
  const [answers, setAnswers] = useState<Answers>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [request, setRequest] = useState<{ area: string | null; notes: string | null } | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [response, status] = await Promise.all([
          api.get(endpoint, { signal }),
          mode === 'profile' ? api.get('/user/clinical-profile-review/status', { signal }) : Promise.resolve(null),
        ]);
        if (signal?.aborted) return;
        const next = response.data.data as Workspace;
        setWorkspace(next);
        setRequest(status?.data?.data?.detailsRequest ?? null);
        const initialArea = status?.data?.data?.detailsRequest?.area;
        const selected = next.availableAreas.includes(initialArea) ? initialArea : (next.availableAreas[0] ?? '');
        setArea(selected);
        setAnswers({ ...empty, ...next.contexts.find((item) => item.area === selected)?.responses });
      } catch (cause) {
        if (!signal?.aborted) setError(getApiErrorMessage(cause, 'Health details could not be loaded.'));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endpoint, mode]
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!workspace || busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await api.put(`${endpoint}/details`, {
        area,
        expectedSafetyRevision: workspace.safetyRevision,
        ...Object.fromEntries(fields.map(([field]) => [field, answers[field].trim()])),
      });
      invalidateSessionResource(ownerId, `clinical-profile-status:${workspace.safetyRevision}`);
      window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
      setWorkspace(response.data.data);
      setMessage('Health details saved for nutritionist review. These answers remain user-provided until reviewed.');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Health details could not be saved.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className={
        mode === 'onboarding' ? 'mx-auto my-auto w-full max-w-2xl space-y-5' : 'portal-page max-w-4xl space-y-6'
      }
    >
      {mode === 'onboarding' ? (
        <>
          <OnboardingProgressSlider currentStep={3} totalSteps={6} />
          <Link
            href={params.get('from') === 'review' ? '/onboarding/conditions?from=review' : '/onboarding/conditions'}
            className="text-sm text-brand-muted"
          >
            Back to medical conditions
          </Link>
        </>
      ) : (
        <PersonalizationTabs activeTab="clinical-evidence" />
      )}
      <header>
        <h1 className="font-display text-3xl font-black">Health details</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Describe the conditions and restrictions already listed in your profile for a nutritionist to review. Enter
          “none” or “unknown” where appropriate. No document upload is needed.
        </p>
      </header>
      {request && (
        <div role="status" className="rounded-xl border border-amber-500 p-4">
          <p className="font-bold">
            A nutritionist requested more details{request.area ? ` for ${friendly(request.area)}` : ''}.
          </p>
          <p>{request.notes}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-brand-green">
          {message}
        </p>
      )}
      {loading ? (
        <p>Loading health details…</p>
      ) : (
        <>
          {!!workspace?.requirements.length && (
            <section className="space-y-2 rounded-xl border border-brand-border p-4">
              {workspace.requirements.map((item) => (
                <p key={item.area} className="text-sm">
                  <strong>{friendly(item.area)}: </strong>
                  {item.message}
                </p>
              ))}
            </section>
          )}
          {!!workspace?.availableAreas.length ? (
            <form
              onSubmit={(event) => void save(event)}
              className="space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-5"
            >
              <label className="block text-sm">
                Related condition or restriction
                <select
                  value={area}
                  onChange={(event) => {
                    const selected = event.target.value;
                    setArea(selected);
                    setAnswers({ ...empty, ...workspace.contexts.find((item) => item.area === selected)?.responses });
                    setMessage(null);
                  }}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-3"
                >
                  {workspace.availableAreas.map((value) => (
                    <option key={value} value={value}>
                      {friendly(value)}
                    </option>
                  ))}
                </select>
              </label>
              {fields.map(([field, label]) => (
                <label key={field} className="block text-sm">
                  {label}
                  <textarea
                    required={field !== 'measurements'}
                    minLength={field === 'conditionDetails' ? 10 : field === 'measurements' ? undefined : 2}
                    maxLength={field === 'measurements' ? 1000 : 2000}
                    rows={3}
                    value={answers[field]}
                    onChange={(event) => setAnswers((current) => ({ ...current, [field]: event.target.value }))}
                    className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-3"
                  />
                </label>
              ))}
              <button
                type="submit"
                disabled={busy}
                className="min-h-12 rounded-xl bg-brand-accent px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Save health details'}
              </button>
            </form>
          ) : (
            <p className="text-sm text-brand-muted">No health details are needed for your current profile.</p>
          )}
          {mode === 'onboarding' && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  router.push(params.get('from') === 'review' ? '/onboarding/tos' : '/onboarding/allergies')
                }
                className="min-h-12 rounded-xl bg-brand-accent px-5 py-3 font-bold text-white"
              >
                {params.get('from') === 'review' ? 'Return to review' : 'Continue to food safety'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

'use client';
import MemberClarifications from '@/features/clinical-clarification/MemberClarifications';
import MemberProfileProposals from '@/features/clinical-clarification/MemberProfileProposals';
import type { ProfileProposalWorkspace } from '@/features/clinical-clarification/profile-proposal-types';
import type { ClarificationWorkspace } from '@/features/clinical-clarification/types';
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
import StateNotice from '@/components/shared/StateNotice';

type Answers = {
  conditionDetails: string;
  medications: string;
  dietaryAdvice: string;
  recentSymptoms: string;
  measurements: string;
};
type Workspace = {
  profileProposals?: ProfileProposalWorkspace;
  clarifications?: ClarificationWorkspace;
  conditionPlanningAssessments?: Array<{ condition: string; reviewerName: string; rationale: string }>;
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
const inSection = (area: string, section: string | null) =>
  section === 'conditions' ? area !== 'FOOD_ALLERGY' : section === 'allergies' ? area === 'FOOD_ALLERGY' : true;
const friendly = (value: string) => value.replace(/_/g, ' ').toLowerCase();
const areaLabel = (value: string) => (value === 'FOOD_ALLERGY' ? 'Allergy details' : friendly(value));
const allergyLabels: Partial<Record<keyof Answers, string>> = {
  conditionDetails: 'Food allergies, intolerances or avoided foods and their reactions',
  medications: 'Medication or supplements used for these restrictions',
  dietaryAdvice: 'Dietary advice for these allergies or restrictions',
  recentSymptoms: 'Recent allergic reactions or food-related symptoms',
};
export default function ClinicalEvidenceWorkspace({
  mode = 'profile',
  detailsSection,
}: {
  mode?: 'profile' | 'onboarding';
  detailsSection?: 'conditions' | 'allergies';
}) {
  const ownerId = useAuth().user?.userId;
  const router = useRouter();
  const params = useSearchParams();
  const requestedSection = detailsSection ?? params.get('section');
  const section =
    mode === 'onboarding' && ['conditions', 'allergies'].includes(requestedSection ?? '') ? requestedSection : null;
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
        const areas = next.availableAreas.filter((value) => inSection(value, section));
        const selected = areas.includes(initialArea)
          ? initialArea
          : (next.requirements.find((item) => inSection(item.area, section) && item.state !== 'READY')?.area ??
            areas[0] ??
            '');
        setArea(selected);
        setAnswers({ ...empty, ...next.contexts.find((item) => item.area === selected)?.responses });
      } catch (cause) {
        if (!signal?.aborted) setError(getApiErrorMessage(cause, 'Health details could not be loaded.'));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endpoint, mode, section]
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
      setMessage('Health details saved for RND review. These answers remain member-provided until reviewed.');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Health details could not be saved.'));
    } finally {
      setBusy(false);
    }
  }
  const areas = workspace?.availableAreas.filter((value) => inSection(value, section)) ?? [];
  const requirements = workspace?.requirements.filter((item) => inSection(item.area, section)) ?? [];
  const pendingAreas = requirements.filter((item) => item.state !== 'READY').map((item) => item.area);
  const selectArea = (selected: string) => {
    setArea(selected);
    setAnswers({ ...empty, ...workspace?.contexts.find((item) => item.area === selected)?.responses });
    setMessage(null);
  };
  return (
    <div
      className={
        mode === 'onboarding' ? 'mx-auto my-auto w-full max-w-2xl space-y-5' : 'portal-page max-w-4xl space-y-6'
      }
    >
      {mode === 'onboarding' ? (
        <>
          <OnboardingProgressSlider currentStep={section === 'conditions' ? 3 : 4} totalSteps={6} />
          <Link
            href={
              params.get('from') === 'review'
                ? '/onboarding/tos'
                : section === 'conditions'
                  ? '/onboarding/conditions'
                  : '/onboarding/allergies'
            }
            className="text-sm text-brand-muted"
          >
            {params.get('from') === 'review'
              ? 'Back to review'
              : section === 'conditions'
                ? 'Back to conditions'
                : 'Back to food safety'}
          </Link>
        </>
      ) : (
        <PersonalizationTabs activeTab="clinical-evidence" />
      )}
      <header>
        <h1 className="font-display text-3xl font-black">
          {section === 'conditions'
            ? 'Condition details'
            : section === 'allergies'
              ? 'Allergy details'
              : 'Health details'}
        </h1>
        {(loading || areas.length > 0) && (
          <p className="mt-2 text-sm text-brand-muted">
            Describe the conditions and restrictions already listed in your profile for an RND to review. Enter “none”
            or “unknown” where appropriate. Complete and save a separate form for each listed condition or restriction.
          </p>
        )}
      </header>
      {request && (
        <div role="status" className="rounded-xl border border-amber-500 p-4">
          <p className="font-bold">
            An RND requested more details{request.area ? ` for ${friendly(request.area)}` : ''}.
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
      {mode === 'profile' && (
        <MemberProfileProposals
          workspace={workspace?.profileProposals}
          onUpdated={async (applied) => {
            if (applied) {
              await load();
              window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
            } else {
              const response = await api.get(endpoint);
              setWorkspace((current) =>
                current ? { ...current, profileProposals: response.data.data.profileProposals } : response.data.data
              );
            }
          }}
        />
      )}
      {mode === 'profile' && (
        <MemberClarifications
          workspace={workspace?.clarifications}
          onUpdated={async () => {
            const response = await api.get(endpoint);
            setWorkspace((current) =>
              current ? { ...current, clarifications: response.data.data.clarifications } : response.data.data
            );
          }}
        />
      )}
      {section !== 'allergies' && !!workspace?.conditionPlanningAssessments?.length && (
        <section className="space-y-3 rounded-xl border border-brand-border bg-brand-surface p-4">
          <h2 className="font-bold">RND condition assessments</h2>
          {workspace.conditionPlanningAssessments.map((assessment) => (
            <div key={assessment.condition}>
              <p className="font-semibold">{assessment.condition} · No additional meal restrictions identified</p>
              <p className="text-sm text-brand-muted">
                Reviewed by {assessment.reviewerName}, RND. {assessment.rationale}
              </p>
            </div>
          ))}
          <p className="text-sm text-brand-muted">
            The conditions remain in your profile. Updating your profile or health details requires a fresh assessment.
          </p>
        </section>
      )}
      {loading ? (
        <p>Loading health details…</p>
      ) : (
        <>
          {!!requirements.length && (
            <section className="space-y-2 rounded-xl border border-brand-border p-4">
              <p className="text-sm font-bold" role="status">
                {requirements.length - pendingAreas.length} of {requirements.length} health detail forms complete.
              </p>
              {!!pendingAreas.length && (
                <p className="text-sm">Still needed: {pendingAreas.map(friendly).join(', ')}.</p>
              )}
              {requirements.map((item) => (
                <p key={item.area} className="text-sm">
                  <strong>{friendly(item.area)}: </strong>
                  {item.message}
                </p>
              ))}
            </section>
          )}
          {!!areas.length ? (
            <form
              onSubmit={(event) => void save(event)}
              className="space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-5"
            >
              <fieldset>
                <legend className="text-sm font-semibold">Choose details to complete</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {areas.map((value) => (
                    <button
                      key={value}
                      type="button"
                      disabled={busy}
                      aria-pressed={area === value}
                      onClick={() => selectArea(value)}
                      className={`min-h-11 rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50 ${
                        area === value
                          ? 'border-brand-accent bg-brand-accent text-white'
                          : 'border-brand-border bg-brand-surface'
                      }`}
                    >
                      {areaLabel(value)}
                    </button>
                  ))}
                </div>
              </fieldset>
              {area === 'FOOD_ALLERGY' && (
                <p className="text-sm text-brand-muted">
                  Describe your declared food allergies, intolerances and avoided foods, including triggers and
                  reactions. These answers are saved separately from your condition details.
                </p>
              )}
              {fields.map(([field, label]) => (
                <label key={field} className="block text-sm">
                  {area === 'FOOD_ALLERGY' ? (allergyLabels[field] ?? label) : label}
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
            workspace && (
              <StateNotice
                variant="no-meal-plan"
                title="No health details are needed for your current profile"
                description={null}
                imageAlt="Sleeping Nara"
                action={null}
              />
            )
          )}
          {mode === 'onboarding' && (
            <div className="flex justify-end">
              <button
                type="button"
                disabled={busy || loading || !workspace || pendingAreas.length > 0}
                onClick={() =>
                  router.push(
                    params.get('from') === 'review'
                      ? '/onboarding/tos'
                      : section === 'conditions'
                        ? '/onboarding/allergies'
                        : '/onboarding/shopping-day'
                  )
                }
                className="min-h-12 rounded-xl bg-brand-accent px-5 py-3 font-bold text-white"
              >
                {params.get('from') === 'review'
                  ? 'Return to review'
                  : section === 'conditions'
                    ? 'Continue to allergies'
                    : 'Continue to shopping day'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

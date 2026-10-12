'use client';
import MemberClarifications from '@/features/clinical-clarification/MemberClarifications';
import MemberProfileProposals from '@/features/clinical-clarification/MemberProfileProposals';
import type { ProfileProposalWorkspace } from '@/features/clinical-clarification/profile-proposal-types';
import type { ClarificationWorkspace } from '@/features/clinical-clarification/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { useAuth } from '@/hooks/useAuth';
import { invalidateSessionResource } from '@/lib/session-resource-cache';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { getApiErrorMessage } from '@/lib/api-error';
import OnboardingStep from '@/components/onboarding/OnboardingStep';
import Button from '@/components/ui/Button';
import PersonalizationTabs from '@/components/user/PersonalizationTabs';
import StateNotice from '@/components/shared/StateNotice';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import HealthDetailsInbox from './HealthDetailsInbox';
import HealthDetailForm, {
  healthDetailFields as fields,
  emptyHealthAnswers as empty,
  type HealthAnswers as Answers,
} from './HealthDetailForm';
import { healthAreaKey, healthInboxItems } from './health-inbox-items';

type Workspace = {
  profileProposals?: ProfileProposalWorkspace;
  clarifications?: ClarificationWorkspace;
  conditionPlanningAssessments?: Array<{ condition: string; reviewerName: string; rationale: string }>;
  safetyRevision: number;
  availableAreas: string[];
  contexts: Array<{ area: string; responses: Partial<Answers> }>;
  requirements: Array<{ area: string; state: string; message: string }>;
};
const inSection = (area: string, section: string | null) =>
  section === 'conditions' ? area !== 'FOOD_ALLERGY' : section === 'allergies' ? area === 'FOOD_ALLERGY' : true;
const friendly = (value: string) => value.replace(/_/g, ' ').toLowerCase();
type WorkspaceProps = { mode?: 'profile' | 'onboarding'; detailsSection?: 'conditions' | 'allergies' };
export default function ClinicalEvidenceWorkspace(props: WorkspaceProps) {
  const ownerId = useAuth().user?.userId;
  return <ClinicalEvidenceContent key={ownerId ?? 'signed-out'} {...props} />;
}
function ClinicalEvidenceContent({ mode = 'profile', detailsSection }: WorkspaceProps) {
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
  const [profileChanged, setProfileChanged] = useState(false);
  const [request, setRequest] = useState<{ area: string | null; notes: string | null } | null>(null);
  const refreshGeneration = useRef(0);
  const dirtyAnswers = useRef(false);
  const drafts = useRef<Record<string, Answers>>({});
  const [inboxSelection, setInboxSelection] = useState('');
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const generation = ++refreshGeneration.current;
      try {
        const [response, status] = await Promise.all([
          api.get(endpoint, { signal }),
          mode === 'profile' ? api.get('/user/clinical-profile-review/status', { signal }) : Promise.resolve(null),
        ]);
        if (signal?.aborted || generation !== refreshGeneration.current) return;
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
        drafts.current = {};
        setInboxSelection(
          healthInboxItems(next).find((item) => item.needsResponse && item.kind !== 'details')?.id ??
            healthAreaKey(selected)
        );
        dirtyAnswers.current = false;
        setProfileChanged(false);
        setError(null);
        return true;
      } catch (cause) {
        if (!signal?.aborted && generation === refreshGeneration.current)
          setError(getApiErrorMessage(cause, 'Health details could not be loaded.'));
        return false;
      } finally {
        if (!signal?.aborted && generation === refreshGeneration.current) setLoading(false);
      }
    },
    [endpoint, mode, section]
  );
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setWorkspace(null);
    setRequest(null);
    setArea('');
    setAnswers(empty);
    setError(null);
    setMessage(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load, ownerId]);
  useVisiblePolling(
    async (signal) => {
      const generation = ++refreshGeneration.current;
      const [response, status] = await Promise.all([
        api.get(endpoint, { signal }),
        api.get('/user/clinical-profile-review/status', { signal }),
      ]);
      if (signal.aborted || generation !== refreshGeneration.current) return;
      const next = response.data.data as Workspace;
      if (workspace && next.safetyRevision !== workspace.safetyRevision) {
        setProfileChanged(true);
        return;
      }
      // Refresh persisted review work without resetting any unsent form draft.
      setWorkspace(next);
      setRequest(status.data?.data?.detailsRequest ?? null);
      const nextAreas = next.availableAreas.filter((value) => inSection(value, section));
      if (!nextAreas.includes(area)) {
        const selected = nextAreas[0] ?? '';
        setArea(selected);
        setAnswers({ ...empty, ...next.contexts.find((item) => item.area === selected)?.responses });
        dirtyAnswers.current = false;
      } else if (!dirtyAnswers.current) {
        setAnswers({ ...empty, ...next.contexts.find((item) => item.area === area)?.responses });
      }
    },
    { enabled: mode === 'profile' && !loading && !busy && Boolean(workspace), immediate: false, scopeKey: ownerId }
  );
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!workspace || busy || profileChanged) return;
    setBusy(true);
    refreshGeneration.current += 1;
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
      dirtyAnswers.current = false;
      delete drafts.current[area];
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
  const hasRecordedReviewDetails =
    mode === 'profile' &&
    (Boolean(request) ||
      Boolean(workspace?.clarifications?.enabled && workspace.clarifications.forms.length) ||
      Boolean(workspace?.profileProposals?.enabled && workspace.profileProposals.proposals.length) ||
      Boolean(workspace?.conditionPlanningAssessments?.length));
  const selectArea = (selected: string) => {
    if (dirtyAnswers.current) drafts.current[area] = answers;
    dirtyAnswers.current = Boolean(drafts.current[selected]);
    setArea(selected);
    setAnswers(
      drafts.current[selected] ?? { ...empty, ...workspace?.contexts.find((item) => item.area === selected)?.responses }
    );
    setMessage(null);
  };
  const items = workspace ? healthInboxItems(workspace) : [];
  const selectedId = items.some((item) => item.id === inboxSelection)
    ? inboxSelection
    : items.some((item) => item.id === healthAreaKey(area))
      ? healthAreaKey(area)
      : (items[0]?.id ?? '');
  const healthForm = (
    <div hidden={mode === 'profile' && !selectedId.startsWith('details:')}>
      <HealthDetailForm
        area={area}
        areas={areas}
        answers={answers}
        busy={busy}
        profileChanged={profileChanged}
        embedded={mode === 'profile'}
        requirement={requirements.find((item) => item.area === area)}
        onSelect={selectArea}
        onChange={(field, value) => {
          dirtyAnswers.current = true;
          setAnswers((current) => ({ ...current, [field]: value }));
        }}
        onSave={(event) => void save(event)}
      />
    </div>
  );
  const reviewWork = (
    <>
      {mode === 'profile' && (
        <div hidden={!selectedId.startsWith('correction:')}>
          <MemberProfileProposals
            embedded
            disabled={profileChanged}
            selectedId={selectedId.startsWith('correction:') ? selectedId.slice(11) : ''}
            workspace={workspace?.profileProposals}
            onUpdated={async (applied) => {
              if (applied) {
                if (!(await load())) throw new Error('Health details could not be refreshed.');
                window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
              } else {
                const generation = ++refreshGeneration.current;
                const response = await api.get(endpoint);
                if (generation !== refreshGeneration.current) return;
                setWorkspace((current) =>
                  current ? { ...current, profileProposals: response.data.data.profileProposals } : response.data.data
                );
              }
            }}
          />
        </div>
      )}
      {mode === 'profile' && (
        <div hidden={!selectedId.startsWith('question:')}>
          <MemberClarifications
            embedded
            disabled={profileChanged}
            selectedId={selectedId.startsWith('question:') ? selectedId.slice(9) : ''}
            workspace={workspace?.clarifications}
            onUpdated={async () => {
              const generation = ++refreshGeneration.current;
              const response = await api.get(endpoint);
              if (generation !== refreshGeneration.current) return;
              setWorkspace((current) =>
                current ? { ...current, clarifications: response.data.data.clarifications } : response.data.data
              );
            }}
          />
        </div>
      )}
      {section !== 'allergies' && !!workspace?.conditionPlanningAssessments?.length && (
        <section hidden={mode === 'profile' && selectedId !== 'assessments'} className="space-y-4">
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
    </>
  );
  const content = (
    <div className={mode === 'onboarding' ? 'w-full space-y-6' : 'portal-page max-w-5xl space-y-6'}>
      {mode === 'profile' && (
        <>
          <PersonalizationTabs activeTab="clinical-evidence" />
          <PortalPageHeader
            title="Health details"
            description={
              loading || items.length > 0
                ? 'Questions from your RND, profile corrections, and your health details — together in one place. Choose a form to read or respond.'
                : ''
            }
          />
        </>
      )}
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
      {profileChanged && (
        <div role="status" className="rounded-xl border border-amber-500 p-4">
          <p>
            Your health profile changed. Reload its current details before saving. Unsent answers have been kept here.
          </p>
          <button type="button" onClick={() => void load()} className="mt-2 font-bold underline">
            Reload current health details
          </button>
        </div>
      )}
      {mode === 'profile' && !loading && items.length > 0 && (
        <HealthDetailsInbox
          items={items}
          selectedId={selectedId}
          disabled={busy}
          onSelect={(id) => {
            if (busy) return;
            setInboxSelection(id);
            setMessage(null);
            if (id.startsWith('details:') && id.slice(8) !== area) selectArea(id.slice(8));
          }}
        >
          {reviewWork}
          {areas.length > 0 && healthForm}
        </HealthDetailsInbox>
      )}
      {mode === 'onboarding' && reviewWork}
      {loading ? (
        <p>Loading health details…</p>
      ) : (
        <>
          {mode === 'onboarding' && !!requirements.length && (
            <section className="space-y-2 border-b border-brand-border pb-5">
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
          {!!areas.length
            ? mode === 'onboarding' && healthForm
            : workspace &&
              !error &&
              !requirements.length &&
              !hasRecordedReviewDetails && (
                <StateNotice
                  variant="no-meal-plan"
                  title="No health details are needed for your current profile"
                  description={null}
                  imageAlt="Sleeping Nara"
                  action={null}
                />
              )}
          {mode === 'onboarding' && (
            <div className="flex justify-end">
              <Button
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
                className="w-full sm:w-auto"
              >
                {params.get('from') === 'review'
                  ? 'Return to review'
                  : section === 'conditions'
                    ? 'Continue to allergies'
                    : 'Continue to shopping day'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
  return mode === 'onboarding' ? (
    <OnboardingStep
      step={section === 'conditions' ? 3 : 4}
      title={
        section === 'conditions' ? 'Condition details' : section === 'allergies' ? 'Allergy details' : 'Health details'
      }
      description={
        loading || areas.length > 0
          ? 'Describe the conditions and restrictions already listed in your profile for an RND to review. Enter “none” or “unknown” where appropriate. Complete and save a separate form for each listed condition or restriction.'
          : undefined
      }
      backHref={
        params.get('from') === 'review'
          ? '/onboarding/tos'
          : section === 'conditions'
            ? '/onboarding/conditions'
            : '/onboarding/allergies'
      }
      backLabel={
        params.get('from') === 'review'
          ? 'Back to review'
          : section === 'conditions'
            ? 'Back to conditions'
            : 'Back to food safety'
      }
      surface={false}
    >
      {content}
    </OnboardingStep>
  ) : (
    content
  );
}

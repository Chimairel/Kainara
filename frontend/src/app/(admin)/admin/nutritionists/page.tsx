'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getApiErrorMessage } from '@/lib/api-error';
import { Stethoscope } from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import PortalLoadingState from '@/components/shared/PortalLoadingState';
import { NutritionistApplicationCard } from '@/features/admin-nutritionists/NutritionistApplicationCard';
import { ProfessionalGrid } from '@/features/admin-nutritionists/ProfessionalGrid';
import type {
  ApplicationActionResponse,
  NutritionistApplication,
  NutritionistRow,
  ScheduleDraft,
} from '@/features/admin-nutritionists/model';
import { useAuth } from '@/hooks/useAuth';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

interface GovernanceSnapshot {
  applications: NutritionistApplication[];
  nutritionists: NutritionistRow[];
}

export default function AdminNutritionistsPage() {
  const ownerId = useAuth().user?.userId;
  const cached = readSessionResource<GovernanceSnapshot>(ownerId, 'admin-professional-governance');
  const [applications, setApplications] = useState<NutritionistApplication[]>(cached?.applications ?? []);
  const [nutritionists, setNutritionists] = useState<NutritionistRow[]>(cached?.nutritionists ?? []);
  const [tab, setTab] = useState<'applications' | 'professionals'>('applications');
  const [isLoading, setIsLoading] = useState(!cached);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const requestVersion = useRef(0);
  const [refreshWarning, setRefreshWarning] = useState(false);

  const fetchData = useCallback(
    async (signal?: AbortSignal) => {
      if (!ownerId) return;
      const version = ++requestVersion.current;
      const isCurrent = () =>
        !signal?.aborted && version === requestVersion.current && ownerId === currentOwner.current;
      try {
        const [applicationResponse, nutritionistResponse] = await Promise.all([
          api.get('/admin/nutritionist-applications', { signal }),
          api.get('/admin/nutritionists', { signal }),
        ]);
        const snapshot = {
          applications: applicationResponse.data?.data || [],
          nutritionists: nutritionistResponse.data?.data || [],
        };
        if (!isCurrent()) return;
        setRefreshWarning(false);
        setApplications(snapshot.applications);
        setNutritionists(snapshot.nutritionists);
        writeSessionResource(ownerId, 'admin-professional-governance', snapshot);
      } catch (caught) {
        if (isCurrent()) {
          if (signal) setRefreshWarning(true);
          else setError(getAdminApplicationError(caught, 'Professional records could not be loaded.'));
        }
      } finally {
        if (isCurrent()) setIsLoading(false);
      }
    },
    [ownerId]
  );

  useVisiblePolling(fetchData, { enabled: Boolean(ownerId) && !workingId, immediate: true, scopeKey: ownerId });
  useEffect(() => {
    currentOwner.current = ownerId;
    return () => {
      currentOwner.current = undefined;
    };
  }, [ownerId]);

  const act = async (
    id: string,
    request: () => Promise<ApplicationActionResponse>,
    successMessage: string | ((result: ApplicationActionResponse) => string)
  ) => {
    setWorkingId(id);
    setError(null);
    setNotice(null);
    try {
      const result = await request();
      setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      await fetchData();
    } catch (caught) {
      setError(getAdminApplicationError(caught, 'The application could not be updated.'));
    } finally {
      setWorkingId(null);
    }
  };

  const activeApplications = useMemo(
    () => applications.filter((item) => !['REJECTED', 'ACTIVATED'].includes(item.status)),
    [applications]
  );
  const completedApplications = useMemo(
    () => applications.filter((item) => ['REJECTED', 'ACTIVATED'].includes(item.status)),
    [applications]
  );
  const verified = nutritionists.filter((item) => item.isVerified);

  if (isLoading) {
    return <PortalLoadingState message="Loading professional governance records..." />;
  }

  const applicationCards = (items: NutritionistApplication[]) =>
    items.map((application) => (
      <NutritionistApplicationCard
        key={application.id}
        application={application}
        onAction={act}
        onRejectionReasonChange={(id, value) => setRejectionReasons((current) => ({ ...current, [id]: value }))}
        onScheduleChange={(id, draft) => setScheduleDrafts((current) => ({ ...current, [id]: draft }))}
        rejectionReason={rejectionReasons[application.id] || ''}
        scheduleDraft={scheduleDrafts[application.id]}
        workingId={workingId}
      />
    ));

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
        icon={Stethoscope}
        eyebrow="Professional governance"
        title="Nutritionist onboarding"
        description="Review applications, conduct required verification calls, and control professional access."
        meta={
          <span className="rounded-full border border-brand-border/70 bg-brand-surface/60 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-brand-muted dark:border-[#173e33] dark:bg-[#0e271f]">
            {activeApplications.length} active · {verified.length} professionals
          </span>
        }
      />
      <PageMessages error={error} notice={notice} />
      {refreshWarning && (
        <p role="status" className="text-xs text-brand-muted">
          Updates paused. Retrying automatically when this page is active.
        </p>
      )}
      <TabSelector tab={tab} applicationCount={applications.length} verifiedCount={verified.length} onChange={setTab} />
      {tab === 'applications' ? (
        <>
          <ApplicationSection
            label="Active pipeline"
            items={activeApplications}
            cards={applicationCards(activeApplications)}
          />
          {completedApplications.length > 0 && (
            <details className="rounded-2xl border border-brand-border bg-brand-surface p-4">
              <summary className="cursor-pointer font-semibold">
                Completed applications ({completedApplications.length})
              </summary>
              <ApplicationSection
                label="Completed applications"
                items={completedApplications}
                cards={applicationCards(completedApplications)}
              />
            </details>
          )}
        </>
      ) : (
        <section>
          <ProfessionalGrid
            nutritionists={verified}
            workingId={workingId}
            onChangeAccess={(nutritionist, suspended, reason) =>
              act(
                nutritionist.id,
                () => api.patch(`/admin/users/${nutritionist.user.id}/suspension`, { suspended, reason }),
                suspended ? 'Nutritionist access revoked. Past reviews are preserved.' : 'Nutritionist access restored.'
              )
            }
            onToggleLead={(nutritionist) =>
              void act(
                nutritionist.id,
                () =>
                  api.patch(`/admin/nutritionists/${nutritionist.id}/lead-capability`, {
                    canLeadReview: !nutritionist.canLeadReview,
                  }),
                `Lead capability ${nutritionist.canLeadReview ? 'removed' : 'granted'}.`
              )
            }
          />
        </section>
      )}
    </div>
  );
}

function PageMessages({ error, notice }: { error: string | null; notice: string | null }) {
  return (
    <>
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"
        >
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-2xl border border-brand-green/20 bg-brand-green/[0.07] p-4 text-sm font-semibold text-brand-green">
          {notice}
        </div>
      )}
    </>
  );
}

function TabSelector({
  tab,
  applicationCount,
  verifiedCount,
  onChange,
}: {
  tab: 'applications' | 'professionals';
  applicationCount: number;
  verifiedCount: number;
  onChange: (tab: 'applications' | 'professionals') => void;
}) {
  return (
    <div className="flex rounded-2xl border border-brand-border bg-brand-surface/60 p-1">
      {(['applications', 'professionals'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`flex-1 rounded-xl px-4 py-3 text-sm font-bold ${tab === option ? 'bg-brand-accent text-[#07100d]' : 'text-brand-muted'}`}
        >
          {option === 'applications' ? `Applications (${applicationCount})` : `Professionals (${verifiedCount})`}
        </button>
      ))}
    </div>
  );
}

function ApplicationSection({
  label,
  items,
  cards,
}: {
  label: string;
  items: NutritionistApplication[];
  cards: React.ReactNode[];
}) {
  return (
    <section>
      <p className="portal-section-label mb-4">
        {label} · {items.length}
      </p>
      {items.length ? (
        <div className="grid gap-5 xl:grid-cols-2">{cards}</div>
      ) : (
        <Card className="p-10 text-center text-sm text-brand-muted">No active applications.</Card>
      )}
    </section>
  );
}

function getAdminApplicationError(caught: unknown, fallback: string) {
  return getApiErrorMessage(caught, fallback);
}

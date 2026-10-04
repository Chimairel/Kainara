'use client';

import { useSessionQuery } from '@/hooks/useSessionQuery';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '@/lib/axios';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { useAuth } from '@/hooks/useAuth';

interface SafetyIncident {
  id: string;
  affectedServingCount?: number;
  reason: string;
  createdAt: string;
  mealLibrary: { mealName: string; status: string; safetyEvidenceStatus: string };
  flaggedByNutritionist: { user: { name: string } } | null;
  flaggedByAdminUser?: { name: string } | null;
}

interface StructuredSafetyOperations {
  usersRequiringReview: number;
  entries: Array<{ domain: string; supportState: string; count: number }>;
}

interface OperationsSnapshot {
  incidents: SafetyIncident[];
  structuredSafety: StructuredSafetyOperations | null;
}

export default function AdminSafetyPanel({ active = true }: { active?: boolean }) {
  const ownerId = useAuth().user?.userId;
  const query = useSessionQuery<OperationsSnapshot>({
    ownerId,
    resource: 'admin-operations-v2',
    enabled: active,
    errorMessage: 'Safety records could not be refreshed. Please try again.',
    fetcher: async () => {
      const [flags, restrictions] = await Promise.all([
        api.get('/admin/safety-incidents'),
        api.get('/admin/structured-safety-operations'),
      ]);
      if (!flags.data?.success || !restrictions.data?.success) throw new Error('Could not load safety records.');
      return { incidents: flags.data.data, structuredSafety: restrictions.data.data };
    },
  });
  const incidents = query.data?.incidents ?? [];
  const structuredSafety = query.data?.structuredSafety;
  const { error, isLoading: loading, refetch: load } = query;

  return (
    <div className="space-y-7">
      <PortalPageHeader
        headingLevel="h2"
        icon={ShieldCheck}
        eyebrow="Governance"
        title="Safety operations"
        description="Monitor pending safety flags and restriction review requirements."
        meta={
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full border border-brand-green/20 bg-brand-green/10 px-4 py-2 text-xs font-bold text-brand-green focus-visible:ring-2 focus-visible:ring-brand-cyan"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        }
      />

      {loading && <p role="status">Loading safety records…</p>}
      {error && (
        <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <section>
        <p className="portal-section-label mb-4">Pending safety flags</p>
        <div className="space-y-3">
          {!loading && query.data && incidents.length === 0 && (
            <Card className="p-6 text-sm text-brand-muted">No pending meal-library safety flags.</Card>
          )}
          {incidents.map((incident) => (
            <Card key={incident.id} className="p-5">
              <div className="flex items-start gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-brand-text">{incident.mealLibrary.mealName}</p>
                  {!!incident.affectedServingCount && incident.affectedServingCount > 1 && (
                    <p className="mt-1 text-xs text-brand-muted">
                      Affects {incident.affectedServingCount} saved servings
                    </p>
                  )}
                  <p className="mt-1 text-sm text-brand-muted">{incident.reason}</p>
                  <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-brand-muted">
                    Flagged by{' '}
                    {incident.flaggedByNutritionist?.user.name ??
                      (incident.flaggedByAdminUser
                        ? `${incident.flaggedByAdminUser.name} (admin)`
                        : 'Former reviewer')}{' '}
                    · {new Date(incident.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {structuredSafety && (
        <section aria-labelledby="structured-safety-heading">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <p id="structured-safety-heading" className="portal-section-label">
              Structured restriction review gates
            </p>
            <p className="text-xs font-bold text-brand-muted">
              {structuredSafety.usersRequiringReview} active members require restriction review
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {structuredSafety.entries.map((entry) => (
              <Card key={`${entry.domain}-${entry.supportState}`} className="p-4">
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-muted">
                  {entry.domain.replaceAll('_', ' ')}
                </p>
                <p className="mt-2 text-2xl font-black text-brand-text">{entry.count}</p>
                <p className="mt-1 text-xs font-semibold text-brand-muted">{entry.supportState.replaceAll('_', ' ')}</p>
              </Card>
            ))}
          </div>
        </section>
      )}

      <Link
        href="/admin/audit"
        className="inline-flex min-h-11 items-center rounded-xl border border-brand-border px-4 py-2 text-sm font-bold text-brand-green"
      >
        View full audit history →
      </Link>
    </div>
  );
}

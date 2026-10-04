'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, ShieldCheck } from 'lucide-react';
import api from '@/lib/axios';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

interface SafetyIncident {
  id: string;
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

export default function AdminOperationsPage() {
  const ownerId = useAuth().user?.userId;
  const cached = readSessionResource<OperationsSnapshot>(ownerId, 'admin-operations');
  const [incidents, setIncidents] = useState<SafetyIncident[]>(cached?.incidents ?? []);
  const [structuredSafety, setStructuredSafety] = useState<StructuredSafetyOperations | null>(
    cached?.structuredSafety ?? null
  );
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(!readSessionResource<OperationsSnapshot>(ownerId, 'admin-operations'));
    setError('');
    try {
      const [incidentResponse, structuredResponse] = await Promise.all([
        api.get('/admin/safety-incidents'),
        api.get('/admin/structured-safety-operations'),
      ]);
      const next = {
        incidents: incidentResponse.data?.data || [],
        structuredSafety: structuredResponse.data?.data || null,
      };
      setIncidents(next.incidents);
      setStructuredSafety(next.structuredSafety);
      writeSessionResource(ownerId, 'admin-operations', next);
    } catch {
      setError('Could not load operational records.');
    } finally {
      setLoading(false);
    }
  }, [ownerId]);

  useVisiblePolling(
    async () => {
      await load();
    },
    { enabled: true, immediate: false, scopeKey: ownerId }
  );
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="portal-page space-y-7">
      <PortalPageHeader
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

      {error && (
        <div role="alert" className="rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      <section>
        <p className="portal-section-label mb-4">Pending safety incidents</p>
        <div className="space-y-3">
          {!loading && incidents.length === 0 && (
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
              {structuredSafety.usersRequiringReview} members require review
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

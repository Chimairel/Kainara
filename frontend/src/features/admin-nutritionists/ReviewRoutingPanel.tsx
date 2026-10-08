'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Switch from '@/components/ui/Switch';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuth } from '@/hooks/useAuth';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { expertiseLabel, routingPriorityLabel } from '@/features/nutritionist-reviews/review-routing';

type Snapshot = {
  config: { enabled: boolean };
  episodes: Array<{
    id: string;
    user: { name: string };
    conditions: string[];
    stage: string;
    reason: string;
    opensAt: string;
    selectedReviewerIds: string[];
  }>;
};
export default function ReviewRoutingPanel() {
  const ownerId = useAuth().user?.userId;
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const [result, setResult] = useState<{ ownerId: string; snapshot: Snapshot } | null>(null);
  const snapshot = result && result.ownerId === ownerId ? result.snapshot : null;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setBusy(false);
    setError(null);
  }, [ownerId]);
  const load = useCallback(async (signal?: AbortSignal) => {
    const requestOwner = currentOwner.current;
    if (!requestOwner) return;
    try {
      const response = await api.get('/admin/review-routing', { signal });
      if (!response.data?.success) throw new Error('Routing status could not be loaded.');
      if (!signal?.aborted && currentOwner.current === requestOwner) {
        setResult({ ownerId: requestOwner, snapshot: response.data.data });
        setError(null);
      }
    } catch (caught) {
      if (!signal?.aborted && currentOwner.current === requestOwner)
        setError(getApiErrorMessage(caught, 'Routing status could not be loaded.'));
    }
  }, []);
  useVisiblePolling(load, { enabled: Boolean(ownerId) && !busy, scopeKey: ownerId, immediate: true });
  const toggle = async (enabled: boolean) => {
    const requestOwner = currentOwner.current;
    if (!requestOwner) return;
    setBusy(true);
    setError(null);
    try {
      const response = await api.patch('/admin/review-routing', { enabled });
      if (!response.data?.success) throw new Error('Routing could not be updated.');
      if (currentOwner.current === requestOwner) await load();
    } catch (caught) {
      if (currentOwner.current === requestOwner) setError(getApiErrorMessage(caught, 'Routing could not be updated.'));
    } finally {
      if (currentOwner.current === requestOwner) setBusy(false);
    }
  };
  return (
    <Card className="mb-5 p-5 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold">Specialist review priority</h2>
          <p className="mt-1 text-xs text-brand-muted">
            Every matching RND gets first access, with the highest verified experience tier as the fallback. Related
            profile, document and meal work shares one 24-hour maximum window.
          </p>
        </div>
        <Switch
          aria-label="Enable specialist review priority"
          checked={snapshot?.config.enabled ?? false}
          disabled={busy || !snapshot}
          onCheckedChange={(value) => {
            void toggle(value);
          }}
        />
      </div>
      <p className="text-xs leading-relaxed text-brand-muted">
        Verify expertise and experience before enabling. When no specialist fully matches, all eligible RNDs tied for
        the highest verified experience get priority automatically. General access opens when neither pool qualifies or
        a deadline is two hours away. Existing work stays accessible. Disabling opens all priority episodes.
      </p>
      {error && (
        <p role="alert" className="text-sm text-status-error-text">
          {error}
        </p>
      )}
      {snapshot && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Recent routing decisions ({snapshot.episodes.length})
          </summary>
          <div className="mt-3 max-h-72 space-y-2 overflow-auto">
            {snapshot.episodes.length ? (
              snapshot.episodes.map((episode) => (
                <div key={episode.id} className="rounded-xl border border-brand-border p-3 text-xs">
                  <p className="font-semibold">
                    {episode.user.name} · {routingPriorityLabel(episode)}
                  </p>
                  <p className="mt-1 text-brand-muted">
                    {episode.conditions.map(expertiseLabel).join(' · ') || 'No condition tags'} ·{' '}
                    {episode.reason.replaceAll('_', ' ').toLowerCase()}
                  </p>
                  {episode.stage === 'SPECIALIST' && (
                    <p className="mt-1">
                      {episode.selectedReviewerIds.length} priority RNDs · opens by{' '}
                      {new Date(episode.opensAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-brand-muted">No routing decisions recorded yet.</p>
            )}
          </div>
        </details>
      )}
    </Card>
  );
}

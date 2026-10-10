'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { useAuth } from '@/hooks/useAuth';
import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { expertiseLabel } from '@/features/nutritionist-reviews/review-routing';

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
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
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
  useVisiblePolling(load, { enabled: Boolean(ownerId), scopeKey: ownerId, immediate: true });
  return (
    <Card className="mb-5 p-5 space-y-4">
      <div>
        <h2 className="font-display text-lg font-bold">Shared RND review queue</h2>
        <p className="mt-1 text-xs leading-relaxed text-brand-muted">
          Every eligible RND has equal access. Expertise, experience and online status do not hide cases or create a
          priority window. Claim a case when you start reviewing it.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-status-error-text">
          {error}
        </p>
      )}
      {snapshot && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold">
            Historical routing decisions ({snapshot.episodes.length})
          </summary>
          <div className="mt-3">
            <WorkspaceTable
              label="Historical routing decisions"
              rows={snapshot.episodes}
              rowKey={(episode) => episode.id}
              emptyMessage="No historical routing decisions recorded."
              columns={[
                { key: 'member', header: 'Member', cell: (episode) => episode.user.name },
                {
                  key: 'access',
                  header: 'Recorded access',
                  cell: (episode) => 'Recorded ' + episode.stage.toLowerCase() + ' access',
                },
                {
                  key: 'conditions',
                  header: 'Conditions / reason',
                  cell: (episode) => (
                    <>
                      {episode.conditions.map(expertiseLabel).join(' · ') || 'No condition tags'} ·{' '}
                      {episode.reason.replaceAll('_', ' ').toLowerCase()}
                    </>
                  ),
                },
                {
                  key: 'priority',
                  header: 'Historical priority',
                  cell: (episode) =>
                    episode.stage === 'SPECIALIST' ? (
                      <>
                        {episode.selectedReviewerIds.length} previously selected RNDs · recorded opening{' '}
                        {new Date(episode.opensAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} PHT
                      </>
                    ) : (
                      '—'
                    ),
                },
              ]}
            />
          </div>
        </details>
      )}
    </Card>
  );
}

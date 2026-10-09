'use client';
import { useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import ProfileProposalCard from './ProfileProposalCard';
import type { ProfileProposal, ProfileProposalWorkspace } from './profile-proposal-types';
export default function MemberProfileProposals({
  workspace,
  onUpdated,
}: {
  workspace?: ProfileProposalWorkspace;
  onUpdated: (applied: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const retry = useRef<{ payload: string; key: string } | null>(null);
  if (!workspace?.enabled || !workspace.proposals.length) return null;
  async function respond(proposal: ProfileProposal, decision: 'ACCEPT' | 'REQUEST_CORRECTION', note: string) {
    if (busy) return;
    const body = { profileRevision: proposal.profileRevision, scopeKey: proposal.scopeKey, decision, note };
    const payload = JSON.stringify({ id: proposal.id, ...body });
    if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      await api.post(`/user/clinical-profile-proposals/${proposal.id}/respond`, {
        ...body,
        requestKey: retry.current.key,
      });
      await onUpdated(decision === 'ACCEPT');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Your response could not be saved.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="RND profile corrections">
      {error && (
        <p role="alert" className="text-sm text-status-error-text">
          {error}
        </p>
      )}
      {workspace.proposals.map((p) => (
        <ProfileProposalCard
          key={p.id}
          proposal={p}
          disabled={busy}
          onRespond={(decision, note) => respond(p, decision, note)}
        />
      ))}
    </section>
  );
}

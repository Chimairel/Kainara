'use client';
import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { formatManilaDate } from '@/lib/manila-date';
import { healthCorrectionFields, proposalFieldLabel, type ProfileProposal } from './profile-proposal-types';

export default function ProfileProposalCard({
  proposal,
  onRespond,
  disabled = false,
}: {
  proposal: ProfileProposal;
  onRespond?: (decision: 'ACCEPT' | 'REQUEST_CORRECTION', note: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [note, setNote] = useState('');
  const comparisons: Array<{ label: string; before: string; after: string }> = proposal.changes.domains.map(
    (section) => ({
      label: proposalFieldLabel(section.domain),
      before:
        proposal.beforeSnapshot.safetyInputs
          .filter((e) => e.domain === section.domain)
          .map((e) => e.value)
          .join(', ') || 'Not recorded',
      after: section.entries.map((e) => e.value).join(', '),
    })
  );
  for (const detail of proposal.changes.healthDetails)
    for (const field of healthCorrectionFields) {
      const old = proposal.beforeSnapshot.healthDetails.find((d) => d.area === detail.area)?.responses[field];
      if (old !== detail[field])
        comparisons.push({
          label: `${proposalFieldLabel(detail.area)} · ${proposalFieldLabel(field)}`,
          before: old || 'Not recorded',
          after: detail[field] || 'Not recorded',
        });
    }
  return (
    <Card className="space-y-4 p-4">
      <header>
        <h3 className="font-bold">Proposed profile correction</h3>
        <p className="text-xs text-brand-muted">
          {proposal.authorName}, RND · {formatManilaDate(proposal.createdAt, { dateStyle: 'medium' })} ·{' '}
          {proposalFieldLabel(proposal.status)}
        </p>
      </header>
      <p className="whitespace-pre-wrap text-sm">{proposal.rationale}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-brand-border">
              <th className="p-2">Field</th>
              <th className="p-2">Saved value</th>
              <th className="p-2">Proposed value</th>
            </tr>
          </thead>
          <tbody>
            {comparisons.map((row) => (
              <tr key={row.label} className="border-b border-brand-border">
                <th className="p-2 font-medium">{row.label}</th>
                <td className="whitespace-pre-wrap p-2 align-top">{row.before}</td>
                <td className="whitespace-pre-wrap p-2 align-top">{row.after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!!proposal.evidenceSnapshot.length && (
        <p className="text-xs text-brand-muted">
          Reviewed clarification: {proposal.evidenceSnapshot.map((e) => e.title).join(', ')}
        </p>
      )}
      {proposal.memberNote && (
        <p className="whitespace-pre-wrap text-sm">
          <strong>Member response: </strong>
          {proposal.memberNote}
        </p>
      )}
      {proposal.status === 'ACCEPTED' && (
        <p className="text-sm text-brand-green">
          Acknowledged and applied as profile revision {proposal.acceptedProfileRevision}.
        </p>
      )}
      {proposal.status === 'CORRECTION_REQUESTED' && (
        <p className="text-sm text-brand-muted">
          The saved profile is unchanged. An RND can review your response and propose a revised correction.
        </p>
      )}
      {onRespond && proposal.status === 'PENDING' && (
        <fieldset disabled={disabled} className="space-y-3">
          <p className="text-sm">
            Your saved profile stays unchanged until you acknowledge this correction. Applying it requires fresh
            planning and review checks.
          </p>
          <label className="block text-sm">
            Response or requested correction
            <textarea
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-3"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void onRespond('ACCEPT', note)}>Acknowledge and apply</Button>
            <Button
              variant="secondary"
              disabled={note.trim().length < 10}
              onClick={() => void onRespond('REQUEST_CORRECTION', note)}
            >
              Request correction
            </Button>
          </div>
        </fieldset>
      )}
    </Card>
  );
}

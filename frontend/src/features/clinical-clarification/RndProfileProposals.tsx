'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import NativeSelect from '@/components/ui/NativeSelect';
import ProfileProposalCard from './ProfileProposalCard';
import type { ClarificationWorkspace } from './types';
import {
  healthCorrectionFields,
  proposalFieldLabel,
  type HealthDetailCorrection,
  type ProfileChanges,
  type ProfileProposalWorkspace,
  type SafetyInput,
} from './profile-proposal-types';

export function useProfileProposalDraft(caseKey: string) {
  const [domains, setDomains] = useState<ProfileChanges['domains']>([]);
  const [healthDetails, setHealthDetails] = useState<HealthDetailCorrection[]>([]);
  const [rationale, setRationale] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  useEffect(() => {
    setDomains([]);
    setHealthDetails([]);
    setRationale('');
    setEvidence([]);
  }, [caseKey]);
  return { domains, setDomains, healthDetails, setHealthDetails, rationale, setRationale, evidence, setEvidence };
}
export default function RndProfileProposals({
  userId,
  profileRevision,
  scopeKey,
  workspace,
  clarifications,
  healthDetails,
  availableAreas,
  canWrite,
  onUpdated,
  draft,
}: {
  userId: string;
  profileRevision: number;
  scopeKey: string;
  workspace?: ProfileProposalWorkspace;
  clarifications?: ClarificationWorkspace;
  healthDetails: Array<{ area: string; responses: Record<string, unknown> }>;
  availableAreas: string[];
  canWrite: boolean;
  onUpdated: () => Promise<void>;
  draft: ReturnType<typeof useProfileProposalDraft>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const retry = useRef<{ payload: string; key: string } | null>(null);
  if (!workspace?.enabled) return null;
  const active = workspace.proposals.find((p) => ['PENDING', 'CORRECTION_REQUESTED'].includes(p.status));
  const resolved = clarifications?.forms.filter((f) => f.status === 'RESOLVED') ?? [];
  const catalogue = [...(workspace.catalogue?.conditions ?? []), ...(workspace.catalogue?.foodSafety ?? [])];
  const blocked =
    !canWrite ||
    busy ||
    active?.status === 'PENDING' ||
    clarifications?.forms.some((f) => ['ANSWERED', 'AWAITING_MEMBER'].includes(f.status));
  const updateDetail = (area: string, field: keyof HealthDetailCorrection, value: string) =>
    draft.setHealthDetails((items) => items.map((d) => (d.area === area ? { ...d, [field]: value } : d)));
  async function publish() {
    if (blocked) return;
    const body = {
      profileRevision,
      scopeKey,
      rationale: draft.rationale,
      changes: { domains: draft.domains, healthDetails: draft.healthDetails },
      evidence: resolved
        .filter((f) => draft.evidence.includes(f.id))
        .map((f) => ({ formId: f.id, responseId: f.resolution!.responseId })),
      ...(active ? { replacesProposalId: active.id } : {}),
    };
    const payload = JSON.stringify({ userId, ...body });
    if (retry.current?.payload !== payload) retry.current = { payload, key: crypto.randomUUID() };
    setBusy(true);
    setError(null);
    try {
      await api.post(`/nutritionist/profile-reviews/${userId}/proposals`, { ...body, requestKey: retry.current.key });
      draft.setDomains([]);
      draft.setHealthDetails([]);
      draft.setRationale('');
      await onUpdated();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Correction could not be proposed.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="Profile correction work">
      {workspace.proposals.map((p) => (
        <ProfileProposalCard key={p.id} proposal={p} />
      ))}
      {error && (
        <p role="alert" className="text-sm text-status-error-text">
          {error}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void publish();
        }}
      >
        <fieldset disabled={!!blocked} className="space-y-4">
          <h3 className="font-bold">Propose a correction</h3>
          <p className="text-xs text-brand-muted">
            Use information reviewed with this member. The member must acknowledge the recorded changes before they
            apply. Confirming a profile for planning remains a separate review.
          </p>
          {!canWrite && <p className="text-xs text-brand-muted">Claim this profile to propose corrections.</p>}
          {(['CONDITION', 'ALLERGY', 'INTOLERANCE', 'AVOIDED_INGREDIENT'] as SafetyInput['domain'][]).map((domain) => {
            const section = draft.domains.find((d) => d.domain === domain);
            return (
              <div key={domain} className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!section}
                    onChange={(e) =>
                      draft.setDomains((items) =>
                        e.target.checked
                          ? [
                              ...items,
                              {
                                domain,
                                entries: workspace.editableInputs
                                  .filter((i) => i.domain === domain)
                                  .map(({ value, provenance }) => ({ value, provenance })),
                              },
                            ]
                          : items.filter((d) => d.domain !== domain)
                      )
                    }
                  />
                  Correct {proposalFieldLabel(domain)}
                </label>
                {section && (
                  <>
                    <p className="text-xs text-brand-muted">
                      Choose a recorded option or describe the declaration. Existing safety checks still apply.
                    </p>
                    {section.entries.map((entry, i) => (
                      <div key={i} className="flex gap-2">
                        <NativeSelect
                          aria-label={`${domain} entry ${i + 1} type`}
                          value={entry.provenance}
                          onChange={(e) =>
                            draft.setDomains((items) =>
                              items.map((d) =>
                                d.domain === domain
                                  ? {
                                      ...d,
                                      entries: d.entries.map((v, n) =>
                                        n === i ? { ...v, provenance: e.target.value as SafetyInput['provenance'] } : v
                                      ),
                                    }
                                  : d
                              )
                            )
                          }
                        >
                          <option value="PREDEFINED">Recorded option</option>
                          <option value="CUSTOM">Custom declaration</option>
                        </NativeSelect>
                        {entry.provenance === 'PREDEFINED' ? (
                          <NativeSelect
                            aria-label={`${domain} entry ${i + 1}`}
                            value={entry.value}
                            className="min-w-0 flex-1"
                            onChange={(e) =>
                              draft.setDomains((items) =>
                                items.map((d) =>
                                  d.domain === domain
                                    ? {
                                        ...d,
                                        entries: d.entries.map((v, n) =>
                                          n === i ? { ...v, value: e.target.value } : v
                                        ),
                                      }
                                    : d
                                )
                              )
                            }
                          >
                            <option value="">Select a declaration</option>
                            {!catalogue.some((c) => c.code === entry.value && c.domains.includes(domain)) &&
                              entry.value && <option value={entry.value}>{proposalFieldLabel(entry.value)}</option>}
                            {catalogue
                              .filter((c) => c.domains.includes(domain))
                              .map((c) => (
                                <option key={c.code} value={c.code}>
                                  {c.displayName}
                                </option>
                              ))}
                          </NativeSelect>
                        ) : (
                          <input
                            aria-label={`${domain} entry ${i + 1}`}
                            className="min-w-0 flex-1 rounded-lg border border-brand-border p-2"
                            value={entry.value}
                            maxLength={300}
                            required
                            onChange={(e) =>
                              draft.setDomains((items) =>
                                items.map((d) =>
                                  d.domain === domain
                                    ? {
                                        ...d,
                                        entries: d.entries.map((v, n) =>
                                          n === i ? { ...v, value: e.target.value } : v
                                        ),
                                      }
                                    : d
                                )
                              )
                            }
                          />
                        )}
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            draft.setDomains((items) =>
                              items.map((d) =>
                                d.domain === domain ? { ...d, entries: d.entries.filter((_, n) => n !== i) } : d
                              )
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={section.entries.length >= 32}
                      onClick={() =>
                        draft.setDomains((items) =>
                          items.map((d) =>
                            d.domain === domain
                              ? { ...d, entries: [...d.entries, { value: '', provenance: 'CUSTOM' }] }
                              : d
                          )
                        )
                      }
                    >
                      Add declaration
                    </Button>
                  </>
                )}
              </div>
            );
          })}
          {availableAreas.map((area) => {
            const selected = draft.healthDetails.find((d) => d.area === area);
            return (
              <div key={area} className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!selected}
                    onChange={(e) =>
                      draft.setHealthDetails((items) =>
                        e.target.checked
                          ? [
                              ...items,
                              {
                                area,
                                ...Object.fromEntries(
                                  healthCorrectionFields.map((f) => [
                                    f,
                                    String(healthDetails.find((d) => d.area === area)?.responses[f] ?? ''),
                                  ])
                                ),
                              } as HealthDetailCorrection,
                            ]
                          : items.filter((d) => d.area !== area)
                      )
                    }
                  />
                  Correct {proposalFieldLabel(area)} details
                </label>
                {selected &&
                  healthCorrectionFields.map((field) => (
                    <label key={field} className="block text-sm">
                      {proposalFieldLabel(field)}
                      <textarea
                        value={selected[field]}
                        rows={2}
                        maxLength={field === 'measurements' ? 1000 : 2000}
                        required={field !== 'measurements'}
                        minLength={field === 'conditionDetails' ? 10 : field === 'measurements' ? 0 : 2}
                        onChange={(e) => updateDetail(area, field, e.target.value)}
                        className="mt-1 w-full rounded-xl border border-brand-border p-3"
                      />
                    </label>
                  ))}
              </div>
            );
          })}
          {resolved.map((f) => (
            <label key={f.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.evidence.includes(f.id)}
                onChange={(e) =>
                  draft.setEvidence((items) =>
                    e.target.checked ? [...items, f.id] : items.filter((id) => id !== f.id)
                  )
                }
              />
              Use resolved clarification: {f.title}
            </label>
          ))}
          <label className="block text-sm">
            Correction rationale
            <textarea
              value={draft.rationale}
              onChange={(e) => draft.setRationale(e.target.value)}
              rows={3}
              required
              minLength={10}
              maxLength={2000}
              className="mt-1 w-full rounded-xl border border-brand-border p-3"
            />
          </label>
          <Button type="submit" disabled={!draft.domains.length && !draft.healthDetails.length}>
            Send correction for acknowledgment
          </Button>
        </fieldset>
      </form>
    </section>
  );
}

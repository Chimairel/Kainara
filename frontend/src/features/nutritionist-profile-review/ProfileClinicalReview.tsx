'use client';
import Dropdown from '@/components/ui/Dropdown';

import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';
type Model = Extract<ReturnType<typeof useProfileWorkPanelModel>, { kind: 'ready' }>;
type SectionProps = {
  section?: 'evidence' | 'decision' | 'all';
  showActions?: boolean;
  model: Pick<
    Model,
    | 'reloadDetail'
    | 'detail'
    | 'requestArea'
    | 'setRequestArea'
    | 'notes'
    | 'setNotes'
    | 'profileBlocked'
    | 'busy'
    | 'decideProfile'
    | 'conditionAssessments'
    | 'setConditionAssessments'
    | 'reviewedDeclarationIds'
    | 'setReviewedDeclarationIds'
  >;
};
export function ProfileDecisionActions({ model }: Pick<SectionProps, 'model'>) {
  const { detail, busy, profileBlocked, notes, decideProfile } = model;
  if (!detail?.profileReview) return null;
  return (
    <div role="group" aria-label="Profile decision actions" className="grid w-full gap-3 sm:grid-cols-3">
      <Button disabled={busy || !detail.profileReview.claim?.mine || !!profileBlocked || notes.trim().length < 10}
        onClick={() => void decideProfile('APPROVED')}>Confirm for planning</Button>
      <Button variant="secondary" disabled={busy || !detail.profileReview.claim?.mine || notes.trim().length < 10}
        onClick={() => void decideProfile('DECLINED')}>Needs correction</Button>
      {!!detail.availableAreas.length && <Button variant="secondary"
        disabled={busy || !detail.profileReview.claim?.mine || notes.trim().length < 10}
        onClick={() => void decideProfile('REQUEST_DETAILS')}>Request details</Button>}
    </div>
  );
}

export default function ProfileClinicalReview({ model, section = 'all', showActions = true }: SectionProps) {
  const {
    detail,
    requestArea,
    setRequestArea,
    notes,
    setNotes,
    profileBlocked,
    busy,
    conditionAssessments,
    setConditionAssessments,
    reviewedDeclarationIds,
    setReviewedDeclarationIds,
  } = model;
  if (!detail) return null;
  return (
    <>
      {detail.profileReview && (
        <section className={section === 'decision' ? 'space-y-6 text-sm' : 'space-y-3 rounded-xl border border-brand-border bg-brand-surface p-4 text-xs'}>
          {section !== 'decision' && (
            <>
              <h4 className="font-bold">Member-provided health details</h4>
              {detail.profileReview.healthDetails?.map((item) => (
                <div key={item.area} className="rounded-lg border border-brand-border p-3">
                  <p className="font-semibold">{item.area.replace(/_/g, ' ')}</p>
                  {['conditionDetails', 'medications', 'dietaryAdvice', 'recentSymptoms', 'measurements'].map(
                    (field) =>
                      typeof item.responses[field] === 'string' && item.responses[field] ? (
                        <p key={field} className="mt-2 whitespace-pre-wrap">
                          <strong>{field.replace(/([A-Z])/g, ' $1')}: </strong>
                          {String(item.responses[field])}
                        </p>
                      ) : null
                  )}
                </div>
              ))}
              {detail.profileReview.previousReview?.notes && (
                <p className="text-brand-muted">Previous review: {detail.profileReview.previousReview.notes}</p>
              )}
              {!!detail.profileReview.conditionReviewEntries?.length && (
                <section aria-label="Recorded condition assessments" className="space-y-3">
                  <h4 className="font-bold">Condition relevance to meal planning</h4>
                  {detail.profileReview.conditionReviewEntries.map(entry => <div key={entry.id}>
                    <p className="font-semibold">{entry.displayName}</p>
                    <p>{entry.assessment
                      ? `No additional restrictions identified · ${entry.assessment.reviewerName}, RND. ${entry.assessment.rationale}`
                      : 'No condition assessment recorded.'}</p>
                  </div>)}
                </section>
              )}
            </>
          )}
          {section !== 'evidence' && (
            <>
              {section === 'all' && <h3 className="font-display text-lg font-semibold text-brand-text">Profile decision</h3>}
              <p className="text-brand-muted">
                If the details are complete and correct, confirm this profile as recorded. Send a correction only when a
                declaration needs to change.
              </p>
              {!!detail.profileReview.conditionReviewEntries?.length && (
                <fieldset
                  className="min-w-0 space-y-4"
                  disabled={busy || !detail.profileReview.claim?.mine}
                >
                  <legend className="mb-2 font-display text-lg font-semibold">Condition relevance to meal planning</legend>
                  <p className="text-brand-muted">
                    Keep each condition recorded. Assess dietary needs, medication or treatment effects, and foodborne
                    illness risk before deciding that it adds no restrictions.
                  </p>
                  {detail.profileReview.conditionReviewEntries.map((entry) => {
                    const draft = conditionAssessments.find((item) => item.entryId === entry.id);
                    const update = (patch: Partial<NonNullable<typeof draft>>) =>
                      setConditionAssessments((items) =>
                        items.map((item) => (item.entryId === entry.id ? { ...item, ...patch } : item))
                      );
                    return (
                      <div key={entry.id} className="space-y-3 border-b border-brand-border pb-5 last:border-0 last:pb-0">
                        <p className="font-semibold text-brand-text">{entry.displayName}</p>
                        {entry.assessment ? (
                          <p className="text-brand-muted">
                            No additional restrictions identified · {entry.assessment.reviewerName}, RND.{' '}
                            {entry.assessment.rationale}
                          </p>
                        ) : entry.canAssessNoAdditionalRestrictions ? (
                          <>
                            <label className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                className="mt-1 h-4 w-4 shrink-0 accent-brand-green"
                                checked={!!draft}
                                onChange={(event) => {
                                  if (event.target.checked)
                                    setReviewedDeclarationIds?.((ids) => ids.filter((id) => id !== entry.id));
                                  setConditionAssessments((items) =>
                                    event.target.checked
                                      ? [
                                          ...items,
                                          {
                                            entryId: entry.id,
                                            rationale: '',
                                            reviewedDietaryAndTreatmentEffects: false,
                                            reviewedFoodborneIllnessRisk: false,
                                          },
                                        ]
                                      : items.filter((item) => item.entryId !== entry.id)
                                  );
                                }}
                              />
                              No additional meal restrictions identified
                            </label>
                            {draft && (
                              <>
                                <label className="block font-medium">
                                  Assessment rationale for {entry.displayName}
                                  <textarea
                                    rows={3}
                                    value={draft.rationale}
                                    maxLength={2000}
                                    onChange={(event) => update({ rationale: event.target.value })}
                                    className="mt-2 block w-full rounded-xl border border-brand-border bg-brand-surface p-3 font-normal"
                                  />
                                </label>
                                <label className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 shrink-0 accent-brand-green"
                                    checked={draft.reviewedDietaryAndTreatmentEffects}
                                    onChange={(event) =>
                                      update({ reviewedDietaryAndTreatmentEffects: event.target.checked })
                                    }
                                  />
                                  I reviewed dietary needs and medication or treatment effects.
                                </label>
                                <label className="flex items-start gap-3">
                                  <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 shrink-0 accent-brand-green"
                                    checked={draft.reviewedFoodborneIllnessRisk}
                                    onChange={(event) => update({ reviewedFoodborneIllnessRisk: event.target.checked })}
                                  />
                                  I reviewed foodborne illness risk and food-handling needs.
                                </label>
                              </>
                            )}
                          </>
                        ) : (
                          <p className="text-brand-muted">
                            Existing dietary review checks apply. Clarify incorrect declarations through the member’s
                            profile.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </fieldset>
              )}
              {!!detail.profileReview.clarificationEntries?.length && (
                <fieldset disabled={busy || !detail.profileReview.claim?.mine} className="space-y-3">
                  <legend className="mb-3 font-display text-lg font-semibold">Declarations to review</legend>
                  {detail.profileReview.clarificationEntries.map((entry) => (
                    <div key={entry.id}>
                      {entry.canReviewAsRecorded ? (
                        <Checkbox
                          id={`review-as-recorded-${entry.id}`}
                          label={`Reviewed as recorded: ${entry.displayName} (${entry.domain.replace(/_/g, ' ').toLowerCase()})`}
                          disabled={busy || !detail.profileReview?.claim?.mine}
                          checked={reviewedDeclarationIds?.includes(entry.id) ?? false}
                          onCheckedChange={(checked) => {
                            if (checked === true)
                              setConditionAssessments((items) => items.filter((item) => item.entryId !== entry.id));
                            setReviewedDeclarationIds((ids) =>
                              checked === true ? [...ids, entry.id] : ids.filter((id) => id !== entry.id)
                            );
                          }}
                        />
                      ) : (
                        <p>{entry.displayName}: request clarification or correct this declaration.</p>
                      )}
                    </div>
                  ))}
                  <p className="text-brand-muted">
                    Confirming retains these restrictions. It does not certify individual meals or remove their review
                    checks.
                  </p>
                </fieldset>
              )}
              {detail.requirements.map((item) => (
                <p key={item.area} className={item.state === 'READY' ? 'text-brand-muted' : 'text-status-pending-text'}>
                  {item.area.replace(/_/g, ' ')}: {item.message}
                </p>
              ))}
              {detail.availableAreas.length > 0 && (
                <label className="block font-medium">
                  Details request area
                  <Dropdown
                    value={requestArea}
                    onChange={(event) => setRequestArea(event)}
                    className="mt-2 block w-full"
                  >
                    {detail.availableAreas.map((area) => (
                      <option key={area} value={area}>
                        {area.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </Dropdown>
                </label>
              )}
              <label className="block font-medium">
                Review notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="mt-2 block w-full rounded-xl border border-brand-border bg-brand-surface p-3 font-normal"
                />
              </label>
              {(!detail.profileReview.claim?.mine || profileBlocked || notes.trim().length < 10) && (
                <FeedbackNotice tone="warning" title="Before confirming for planning:">
                  <ul className="mt-2 list-disc space-y-1 pl-4">
                    {detail.profileReview.profileProposals?.proposals.some((p) =>
                      ['PENDING', 'CORRECTION_REQUESTED'].includes(p.status)
                    ) && (
                      <li>Wait for the member to acknowledge the correction, or resolve their requested correction.</li>
                    )}
                    {detail.profileReview.clarifications?.forms.some(
                      (form) => form.status === 'AWAITING_MEMBER' || form.status === 'ANSWERED'
                    ) && <li>Review and resolve the current clarification forms.</li>}
                    {!detail.profileReview.claim?.mine && (
                      <li>
                        {detail.profileReview.claim?.active
                          ? 'Wait for the current claim to be released or expire.'
                          : 'Claim this profile using the button above.'}
                      </li>
                    )}
                    {detail.requirements
                      .filter((item) => item.state !== 'READY')
                      .map((item) => (
                        <li key={item.area}>
                          Ask the member to complete and save {item.area.replace(/_/g, ' ').toLowerCase()} details.
                        </li>
                      ))}
                    {(detail.profileReview.clarificationEntryIds
                      ? detail.profileReview.clarificationEntryIds.some(
                          (id) =>
                            !conditionAssessments.some((item) => item.entryId === id) &&
                            !reviewedDeclarationIds?.includes(id)
                        )
                      : detail.profileReview.needsClarification) && (
                      <li>
                        Review the listed declarations as recorded, or request clarification for entries that remain
                        unclear.
                      </li>
                    )}
                    {conditionAssessments.some(
                      (item) =>
                        item.rationale.trim().length < 10 ||
                        !item.reviewedDietaryAndTreatmentEffects ||
                        !item.reviewedFoodborneIllnessRisk
                    ) && <li>Complete each selected condition’s rationale and both assessment checks.</li>}
                    {notes.trim().length < 10 && <li>Add review notes of at least 10 characters.</li>}
                  </ul>
                </FeedbackNotice>
              )}
              {showActions && <ProfileDecisionActions model={model} />}
            </>
          )}
        </section>
      )}
    </>
  );
}

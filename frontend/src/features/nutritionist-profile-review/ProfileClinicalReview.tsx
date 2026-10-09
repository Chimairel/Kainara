'use client';
import Dropdown from '@/components/ui/Dropdown';

import Button from '@/components/ui/Button';

import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';
type Model = Extract<ReturnType<typeof useProfileWorkPanelModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
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
  >;
};
export default function ProfileClinicalReview({ model }: SectionProps) {
  const {
    detail,
    requestArea,
    setRequestArea,
    notes,
    setNotes,
    profileBlocked,
    busy,
    decideProfile,
    conditionAssessments,
    setConditionAssessments,
  } = model;
  if (!detail) return null;
  return (
    <>
      {detail.profileReview && (
        <section className="space-y-3 rounded-xl border border-brand-border bg-brand-surface p-4 text-xs">
          <h3 className="font-bold text-brand-text">Profile decision</h3>
          <h4 className="font-bold">Member-provided health details</h4>
          {detail.profileReview.healthDetails?.map((item) => (
            <div key={item.area} className="rounded-lg border border-brand-border p-3">
              <p className="font-semibold">{item.area.replace(/_/g, ' ')}</p>
              {['conditionDetails', 'medications', 'dietaryAdvice', 'recentSymptoms', 'measurements'].map((field) =>
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
            <fieldset
              className="space-y-3 rounded-lg border border-brand-border p-3"
              disabled={busy || !detail.profileReview.claim?.mine}
            >
              <legend className="px-1 font-bold">Condition relevance to meal planning</legend>
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
                  <div key={entry.id} className="space-y-2 rounded-lg border border-brand-border p-3">
                    <p className="font-semibold">{entry.displayName}</p>
                    {entry.assessment ? (
                      <p className="text-brand-muted">
                        No additional restrictions identified · {entry.assessment.reviewerName}, RND.{' '}
                        {entry.assessment.rationale}
                      </p>
                    ) : entry.canAssessNoAdditionalRestrictions ? (
                      <>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={!!draft}
                            onChange={(event) =>
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
                              )
                            }
                          />
                          No additional meal restrictions identified
                        </label>
                        {draft && (
                          <>
                            <label className="block">
                              Assessment rationale for {entry.displayName}
                              <textarea
                                rows={3}
                                value={draft.rationale}
                                maxLength={2000}
                                onChange={(event) => update({ rationale: event.target.value })}
                                className="mt-1 block w-full rounded-lg border border-brand-border bg-brand-surface p-2"
                              />
                            </label>
                            <label className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={draft.reviewedDietaryAndTreatmentEffects}
                                onChange={(event) =>
                                  update({ reviewedDietaryAndTreatmentEffects: event.target.checked })
                                }
                              />
                              I reviewed dietary needs and medication or treatment effects.
                            </label>
                            <label className="flex items-start gap-2">
                              <input
                                type="checkbox"
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
          {detail.requirements.map((item) => (
            <p key={item.area} className={item.state === 'READY' ? 'text-brand-muted' : 'text-amber-500'}>
              {item.area.replace(/_/g, ' ')}: {item.message}
            </p>
          ))}
          {detail.availableAreas.length > 0 && (
            <label className="block">
              Details request area
              <Dropdown
                value={requestArea}
                onChange={(event) => setRequestArea(event)}
                className="mt-1 block w-full rounded-lg border border-brand-border bg-brand-surface p-2"
              >
                {detail.availableAreas.map((area) => (
                  <option key={area} value={area}>
                    {area.replace(/_/g, ' ')}
                  </option>
                ))}
              </Dropdown>
            </label>
          )}
          <label className="block">
            Review notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="mt-1 block w-full rounded-lg border border-brand-border bg-brand-surface p-2"
            />
          </label>
          {(!detail.profileReview.claim?.mine || profileBlocked || notes.trim().length < 10) && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3" role="status">
              <strong>Before confirming for planning:</strong>
              <ul className="mt-2 list-disc space-y-1 pl-4">
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
                      (id) => !conditionAssessments.some((item) => item.entryId === id)
                    )
                  : detail.profileReview.needsClarification) && (
                  <li>Resolve the profile restrictions that need clarification.</li>
                )}
                {conditionAssessments.some(
                  (item) =>
                    item.rationale.trim().length < 10 ||
                    !item.reviewedDietaryAndTreatmentEffects ||
                    !item.reviewedFoodborneIllnessRisk
                ) && <li>Complete each selected condition’s rationale and both assessment checks.</li>}
                {notes.trim().length < 10 && <li>Add review notes of at least 10 characters.</li>}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy || !detail.profileReview.claim?.mine || !!profileBlocked || notes.trim().length < 10}
              onClick={() => void decideProfile('APPROVED')}
            >
              Confirm for planning
            </Button>
            <Button
              variant="secondary"
              disabled={busy || !detail.profileReview.claim?.mine || notes.trim().length < 10}
              onClick={() => void decideProfile('DECLINED')}
            >
              Needs correction
            </Button>
            {!!detail.availableAreas.length && (
              <Button
                variant="secondary"
                disabled={busy || !detail.profileReview.claim?.mine || notes.trim().length < 10}
                onClick={() => void decideProfile('REQUEST_DETAILS')}
              >
                Request details
              </Button>
            )}
          </div>
        </section>
      )}
    </>
  );
}

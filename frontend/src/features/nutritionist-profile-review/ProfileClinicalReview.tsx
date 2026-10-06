'use client';
import Dropdown from '@/components/ui/Dropdown';

import Button from '@/components/ui/Button';

import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';
type Model = Extract<ReturnType<typeof useProfileWorkPanelModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    'detail' | 'requestArea' | 'setRequestArea' | 'notes' | 'setNotes' | 'profileBlocked' | 'busy' | 'decideProfile'
  >;
};
export default function ProfileClinicalReview({ model }: SectionProps) {
  const { detail, requestArea, setRequestArea, notes, setNotes, profileBlocked, busy, decideProfile } = model;
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
                {detail.profileReview.needsClarification && (
                  <li>Resolve the profile restrictions that need clarification.</li>
                )}
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

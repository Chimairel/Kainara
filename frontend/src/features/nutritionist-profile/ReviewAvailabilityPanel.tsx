'use client';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Switch from '@/components/ui/Switch';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { expertiseLabel } from '@/features/nutritionist-reviews/review-routing';

export default function ReviewAvailabilityPanel({
  acceptingReviews = false,
  verifiedExpertise = [],
  verifiedExperienceYears,
}: {
  acceptingReviews?: boolean;
  verifiedExpertise?: string[];
  verifiedExperienceYears?: number | null;
}) {
  const [accepting, setAccepting] = useState(acceptingReviews);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setAccepting(acceptingReviews);
  }, [acceptingReviews]);
  const update = async (value: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.patch('/nutritionist/review-availability', { acceptingReviews: value });
      if (!response.data?.success) throw new Error('Availability could not be saved.');
      setAccepting(response.data.data.acceptingReviews);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Availability could not be saved.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold">Review availability</h2>
          <label htmlFor="review-availability" className="text-sm">
            Accepting new reviews
          </label>
        </div>
        <Switch
          id="review-availability"
          aria-label="Accepting new reviews"
          checked={accepting}
          disabled={busy}
          onCheckedChange={(value) => {
            void update(value);
          }}
        />
      </div>
      <p className="text-xs leading-relaxed text-brand-muted">
        Pause new specialist assignments when unavailable. You can finish reviews you already claimed. Working hours are
        not required.
      </p>
      <div className="rounded-xl border border-brand-border p-3 text-sm">
        <p className="font-semibold">Admin-verified expertise</p>
        <p className="mt-1 text-brand-muted">
          {verifiedExpertise.length
            ? verifiedExpertise.map(expertiseLabel).join(' · ')
            : 'No specialist expertise verified yet.'}
        </p>
        {verifiedExperienceYears != null && (
          <p className="mt-1 text-xs text-brand-muted">
            {verifiedExperienceYears} verified year{verifiedExperienceYears === 1 ? '' : 's'} of experience
          </p>
        )}
        <p className="mt-2 text-xs text-brand-muted">
          Editing your public specialization does not change specialist routing.
        </p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-status-error-text">
          {error}
        </p>
      )}
    </Card>
  );
}

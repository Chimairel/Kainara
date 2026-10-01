'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import Link from 'next/link';
import CheckinModal from '@/components/user/CheckinModal';

type Status = {
  isDue: boolean;
  hasPendingChanges?: boolean;
  safetyChanged?: boolean;
  profileRevision?: number;
  weeksSinceConfirmation?: number;
  activePlanningVersion?: number | null;
  activeGeneratedAt?: string | null;
};

export default function WeeklyProfileNotice() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const query = useSessionQuery<Status>({
    ownerId: user?.userId,
    resource: 'weekly-profile-status-v2',
    enabled: Boolean(user?.onboardingDone && user?.tosAccepted),
    fetcher: async () => (await api.get('/user/checkin/status')).data.data,
    errorMessage: 'Weekly profile status could not be checked.',
  });
  const { refetch } = query;
  useEffect(() => {
    const refresh = () => {
      void refetch();
    };
    window.addEventListener('kainara:checkin-updated', refresh);
    return () => window.removeEventListener('kainara:checkin-updated', refresh);
  }, [refetch]);
  useEffect(() => {
    setOpen(false);
  }, [user?.userId]);
  const status = query.data;
  if (!status || (!status.isDue && !status.hasPendingChanges)) return null;
  const weeks = status.weeksSinceConfirmation ?? 1;
  return (
    <>
      <section
        role="status"
        aria-label="Profile planning status"
        className="shrink-0 border-b border-brand-border bg-brand-bgAlt px-4 py-3 text-sm text-brand-text md:px-5"
      >
        {status.isDue && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>
              {weeks >= 2
                ? `You last confirmed your profile ${weeks} weeks ago. Review your details to keep your information current.`
                : 'Your weekly profile check-in is due. Review your details or confirm they are still the same.'}
            </p>
            <button type="button" onClick={() => setOpen(true)} className="font-semibold text-brand-green underline">
              Complete check-in
            </button>
          </div>
        )}
        {status.hasPendingChanges && (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
            <p>
              {status.safetyChanged
                ? 'Your health context changed. Affected recommendations need revalidation.'
                : 'Your saved profile updates have not been applied to meal planning.'}
              {status.activeGeneratedAt &&
                ` Planning report dated ${new Date(status.activeGeneratedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}.`}
            </p>
            <Link href="/profile/nutrition-report" className="font-semibold text-brand-green underline">
              Review report
            </Link>
          </div>
        )}
      </section>
      <CheckinModal
        isOpen={open}
        onClose={() => setOpen(false)}
        profileRevision={status.profileRevision}
        hasPendingChanges={status.hasPendingChanges}
      />
    </>
  );
}

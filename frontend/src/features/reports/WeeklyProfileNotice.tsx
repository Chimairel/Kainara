'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import api from '@/lib/axios';
import AnnouncementBanner from '@/components/shared/AnnouncementBanner';
import CheckinModal from '@/components/user/CheckinModal';
import { PortalAnnouncement, announcementPriority } from '@/components/shared/PortalAnnouncements';

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
      {status.isDue && (
        <PortalAnnouncement priority={announcementPriority.checkin}>
          <div role="status" aria-label="Profile planning status">
            <AnnouncementBanner
              variant="warning"
              ariaLabel="Weekly check-in reminder"
              title={weeks >= 2 ? 'Check-in overdue:' : 'Weekly check-in:'}
              message={
                weeks >= 2
                  ? `You last confirmed your profile ${weeks} weeks ago. Review your details to keep your information current.`
                  : 'Your profile check-in is due. Review your details or confirm they are still the same.'
              }
              action={{ label: 'Complete check-in', onClick: () => setOpen(true) }}
            />
          </div>
        </PortalAnnouncement>
      )}
      {status.hasPendingChanges && (
        <PortalAnnouncement
          priority={status.safetyChanged ? announcementPriority.safety : announcementPriority.information}
        >
          <div role="status" aria-label="Profile planning status">
            <AnnouncementBanner
              variant={status.safetyChanged ? 'warning' : 'info'}
              ariaLabel="Unapplied profile updates"
              title={status.safetyChanged ? 'Action required:' : 'Profile updates:'}
              message={
                <>
                  {status.safetyChanged
                    ? 'Your health context changed. Affected recommendations need revalidation.'
                    : 'Your saved profile updates have not been applied to meal planning.'}
                  {status.activeGeneratedAt &&
                    ` Planning report dated ${new Date(status.activeGeneratedAt).toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' })}.`}
                </>
              }
              action={{ label: 'Review report', href: '/profile/nutrition-report' }}
            />
          </div>
        </PortalAnnouncement>
      )}
      <CheckinModal
        isOpen={open}
        onClose={() => setOpen(false)}
        profileRevision={status.profileRevision}
        hasPendingChanges={status.hasPendingChanges}
      />
    </>
  );
}

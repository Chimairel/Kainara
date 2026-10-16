'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import RouteGuard from '@/components/shared/RouteGuard';
import Sidebar from '@/components/ui/Sidebar';
import BottomNav from '@/components/ui/BottomNav';
import Navbar from '@/components/shared/Navbar';
import AnnouncementBanner from '@/components/shared/AnnouncementBanner';
import { useAuth } from '@/hooks/useAuth';
import { MembershipProvider } from '@/features/membership/MembershipProvider';
import WeeklyProfileNotice from '@/features/reports/WeeklyProfileNotice';
import MembershipNotice from '@/features/membership/MembershipNotice';
import BackgroundResourceBoundary from '@/features/navigation/BackgroundResourceBoundary';
import MemberAssistantShell from '@/features/member-assistant/MemberAssistantShell';
import {
  PortalAnnouncementsProvider,
  PortalAnnouncements,
  PortalAnnouncement,
  announcementPriority,
} from '@/components/shared/PortalAnnouncements';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const pathname = usePathname();

  const isReportPending = Boolean(
    user?.onboardingDone && user?.tosAccepted && !user?.reportAcknowledged && !pathname?.includes('nutrition-report')
  );

  return (
    <RouteGuard>
      <PortalAnnouncementsProvider key={user?.userId}>
        <MembershipProvider key={user?.userId}>
          <BackgroundResourceBoundary ownerId={user?.userId} />
          <MemberAssistantShell key={user?.userId} ready={Boolean(user?.role === 'USER' && user.onboardingDone && user.tosAccepted)}>
            <Sidebar />
            {/* Let the navbar's menus stack above the floating assistant. */}
            <div className="relative flex min-w-0 flex-1 flex-col md:pl-4">
              <Navbar />
              {isReportPending && (
                <PortalAnnouncement
                  priority={announcementPriority.action}
                  summary="Review your nutrition report to start meal planning"
                >
                  <AnnouncementBanner
                    title="Action required:"
                    message="Review your nutrition report and choose it for meal planning."
                    action={{
                      label: 'View Nutrition Report',
                      href: '/profile/nutrition-report',
                    }}
                  />
                </PortalAnnouncement>
              )}
              <WeeklyProfileNotice />
              <main className="portal-main custom-scrollbar relative flex-1 overflow-y-auto pb-36 md:pb-4">
                <PortalAnnouncements />
                {children}
              </main>
            </div>
            <BottomNav />
            <MembershipNotice />
          </MemberAssistantShell>
        </MembershipProvider>
      </PortalAnnouncementsProvider>
    </RouteGuard>
  );
}

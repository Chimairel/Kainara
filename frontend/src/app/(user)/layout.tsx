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
          <div className="portal-shell flex h-screen w-full p-0 md:p-4">
            <Sidebar />
            <div className="relative z-10 flex min-w-0 flex-1 flex-col md:pl-4">
              <Navbar />
              {isReportPending && (
                <PortalAnnouncement priority={announcementPriority.action}>
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
          </div>
        </MembershipProvider>
      </PortalAnnouncementsProvider>
    </RouteGuard>
  );
}

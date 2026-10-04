import { Suspense } from 'react';
import AdminOverviewWorkspace from '@/features/admin-analytics/AdminOverviewWorkspace';
import PortalLoadingState from '@/components/shared/PortalLoadingState';

export default function Page() {
  return (
    <Suspense fallback={<PortalLoadingState message="Loading overview..." />}>
      <AdminOverviewWorkspace />
    </Suspense>
  );
}

import { Suspense } from 'react';
import AdminPeopleWorkspace from '@/features/admin-people/AdminPeopleWorkspace';
import PortalLoadingState from '@/components/shared/PortalLoadingState';

export default function Page() {
  return (
    <Suspense fallback={<PortalLoadingState message="Loading users..." />}>
      <AdminPeopleWorkspace />
    </Suspense>
  );
}

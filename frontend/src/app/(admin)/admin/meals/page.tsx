import { Suspense } from 'react';
import AdminMealsWorkspace from '@/features/admin-meals/AdminMealsWorkspace';
import PortalLoadingState from '@/components/shared/PortalLoadingState';

export default function Page() {
  return (
    <Suspense fallback={<PortalLoadingState message="Loading meals..." />}>
      <AdminMealsWorkspace />
    </Suspense>
  );
}

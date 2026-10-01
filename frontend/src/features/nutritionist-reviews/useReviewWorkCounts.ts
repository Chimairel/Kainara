import { useSessionQuery } from '@/hooks/useSessionQuery';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import api from '@/lib/axios';

export interface ReviewWorkCounts {
  meal: number;
  case: number;
  profile: number;
  audit?: number;
}

export function useReviewWorkCounts() {
  const { user } = useAuth();
  const { data, refetch } = useSessionQuery<ReviewWorkCounts>({
    ownerId: user?.userId,
    resource: 'nutritionist-review-work-counts',
    enabled: user?.role === 'NUTRITIONIST',
    fetcher: async () => (await api.get('/nutritionist/review-work-counts')).data.data,
    errorMessage: 'Review counts could not be refreshed.',
  });
  useEffect(() => {
    const refresh = () => void refetch();
    window.addEventListener('nutrimind:review-work-updated', refresh);
    return () => window.removeEventListener('nutrimind:review-work-updated', refresh);
  }, [refetch]);
  return data;
}

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/axios';

export interface ReviewWorkCounts {
  meal: number;
  case: number;
  profile: number;
}

export function useReviewWorkCounts() {
  const [counts, setCounts] = useState<ReviewWorkCounts | null>(null);
  const refresh = useCallback(async () => {
    try {
      const response = await api.get('/nutritionist/review-work-counts');
      if (response.data?.success) setCounts(response.data.data);
    } catch {
      // Leave the last known counts visible; the next refresh can recover.
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    window.addEventListener('nutrimind:review-work-updated', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('nutrimind:review-work-updated', onFocus);
    };
  }, [refresh]);

  return counts;
}

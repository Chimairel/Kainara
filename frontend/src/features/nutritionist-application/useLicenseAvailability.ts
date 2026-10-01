import { useEffect, useState } from 'react';
import api from '@/lib/axios';

export function useLicenseAvailability(value: string, enabled: boolean) {
  const license = value.trim().toUpperCase();
  const [result, setResult] = useState<{
    license: string;
    state: 'checking' | 'available' | 'taken' | 'unavailable';
  } | null>(null);
  useEffect(() => {
    if (!enabled || !/^[A-Z0-9-]{5,80}$/.test(license)) return;
    const controller = new AbortController();
    setResult({ license, state: 'checking' });
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.post(
          '/nutritionist-applications/license-availability',
          { prcLicenseNumber: license },
          { signal: controller.signal }
        );
        if (!controller.signal.aborted)
          setResult({ license, state: response.data.data.available ? 'available' : 'taken' });
      } catch {
        if (!controller.signal.aborted) setResult({ license, state: 'unavailable' });
      }
    }, 500);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [license, enabled]);
  return enabled && result?.license === license ? result.state : null;
}

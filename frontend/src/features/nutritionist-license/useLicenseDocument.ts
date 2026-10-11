'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { LicenseUpdate } from './types';

export function useLicenseDocument(ownerId: string | undefined, role: 'admin' | 'nutritionist') {
  const currentOwner = useRef(ownerId);
  currentOwner.current = ownerId;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function download(record: LicenseUpdate) {
    if (!ownerId || busy) return;
    setBusy(record.id);
    setError(null);
    try {
      const response = await api.get(`/${role}/license-updates/${encodeURIComponent(record.id)}/document`, {
        responseType: 'blob',
      });
      if (!mounted.current || currentOwner.current !== ownerId) return;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = record.originalFileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (cause) {
      if (mounted.current && currentOwner.current === ownerId)
        setError(getApiErrorMessage(cause, 'The license document could not be downloaded. Try again.'));
    } finally {
      if (mounted.current && currentOwner.current === ownerId) setBusy(null);
    }
  }
  return { download, busy, error };
}

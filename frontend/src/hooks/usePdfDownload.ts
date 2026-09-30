'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AxiosRequestConfig } from 'axios';
import { downloadPdf } from '@/lib/pdf-download';

/** Shared PDF busy state, duplicate-click guard and cancellation for every account page. */
export function usePdfDownload(ownerId: string | undefined) {
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => {
    setIsDownloadingPdf(false);
    return () => {
      request.current?.abort();
      request.current = null;
    };
  }, [ownerId]);

  const startPdfDownload = useCallback(async (url: string, filename: string, config: AxiosRequestConfig = {}) => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setIsDownloadingPdf(true);
    try {
      await downloadPdf(url, filename, { ...config, signal: controller.signal });
    } catch (error) {
      if (!controller.signal.aborted) throw error;
    } finally {
      if (request.current === controller) {
        request.current = null;
        setIsDownloadingPdf(false);
      }
    }
  }, []);

  return { isDownloadingPdf, startPdfDownload };
}

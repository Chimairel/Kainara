'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { isEmbeddedAppBrowser } from '@/lib/browser-environment';

type RecoveryReason = 'embedded-browser' | 'popup' | null;

export function useGoogleSignInRecovery() {
  const [embeddedBrowser, setEmbeddedBrowser] = useState(false);
  const [reason, setReason] = useState<RecoveryReason>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const cleanupRef = useRef<(() => void) | null>(null);

  const stopAttempt = useCallback(() => {
    cleanupRef.current?.();
    cleanupRef.current = null;
  }, []);

  useEffect(() => {
    // Known Meta app markers only; mobile Chrome/Safari are not embedded browsers.
    const embedded = isEmbeddedAppBrowser(navigator.userAgent);
    setEmbeddedBrowser(embedded);
    setPageUrl(`${window.location.origin}${window.location.pathname}`);
    if (embedded) setReason('embedded-browser');
    return stopAttempt;
  }, [stopAttempt]);

  const startAttempt = useCallback(() => {
    stopAttempt();
    setReason(null);
    // GIS id.renderButton has click_listener, but no popup error callback.
    // Offer recovery if this page stays focused; never call this a proven failure.
    const onBlur = () => {
      if (!document.hasFocus()) stopAttempt();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stopAttempt();
    };
    const timer = window.setTimeout(() => {
      const stillHere = document.hasFocus() && document.visibilityState === 'visible';
      stopAttempt();
      if (stillHere) setReason('popup');
    }, 4000);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    cleanupRef.current = () => {
      window.clearTimeout(timer);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [stopAttempt]);

  const close = () => {
    stopAttempt();
    setReason(null);
    setCopyStatus('');
  };

  const showHelp = () => {
    stopAttempt();
    setCopyStatus('');
    setReason(embeddedBrowser ? 'embedded-browser' : 'popup');
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopyStatus('Link copied. Paste it into Chrome or Safari.');
    } catch {
      setCopyStatus('Copy the website address below and paste it into Chrome or Safari.');
    }
  };

  return { embeddedBrowser, reason, pageUrl, copyStatus, startAttempt, stopAttempt, close, showHelp, copyLink };
}

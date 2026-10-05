'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { isAxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error';
import { AlertTriangle } from 'lucide-react';
import FloatingNotice from '@/components/shared/FloatingNotice';
import Button from '@/components/ui/Button';
import { useGoogleSignInRecovery } from './useGoogleSignInRecovery';
import { isEmbeddedAppBrowser } from '@/lib/browser-environment';

/**
 * Google Identity Services "Sign in with Google" button.
 * Loads the GIS script, renders the button, and handles the callback.
 */

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

interface GoogleSignInButtonProps {
  label?: string;
  disabled?: boolean;
  onCredential?: (credential: string) => Promise<void>;
}

type GoogleCredentialResponse = { credential: string };

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let googleScriptPromise: Promise<void> | null = null;
let initializedClientId: string | null = null;
let activeCredentialHandler: ((response: GoogleCredentialResponse) => void) | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    const script = existingScript ?? document.createElement('script');

    const handleLoad = () => resolve();
    const handleError = () => {
      googleScriptPromise = null;
      reject(new Error('Google Identity Services failed to load.'));
    };

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });

    if (!existingScript) {
      script.src = GOOGLE_SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  });

  return googleScriptPromise;
}

export default function GoogleSignInButton({
  label = 'continue_with',
  disabled = false,
  onCredential,
}: GoogleSignInButtonProps) {
  const { login } = useAuth();
  const recovery = useGoogleSignInRecovery();
  const buttonRef = useRef<HTMLDivElement>(null);
  const credentialActionRef = useRef(onCredential);
  const [error, setError] = useState<string | null>(null);
  const [recoveryLink, setRecoveryLink] = useState<{ href: string; label: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    credentialActionRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      return; // Google OAuth not configured — hide button silently
    }

    let cancelled = false;
    if (isEmbeddedAppBrowser(navigator.userAgent)) return;
    activeCredentialHandler = handleGoogleCallback;

    void loadGoogleIdentityServices()
      .then(() => {
        if (cancelled || !window.google || !buttonRef.current) return;

        if (initializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: GoogleCredentialResponse) => activeCredentialHandler?.(response),
            auto_select: false,
          });
          initializedClientId = clientId;
        }

        buttonRef.current.replaceChildren();
        window.google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: Math.min(Math.max(buttonRef.current.clientWidth, 280), 400),
          text: label,
          shape: 'rectangular',
          logo_alignment: 'left',
          click_listener: recovery.startAttempt,
        });
        setIsReady(true);
      })
      .catch(() => {
        if (!cancelled) setError('Google sign-in is temporarily unavailable. Please use email instead.');
      });

    return () => {
      cancelled = true;
      recovery.stopAttempt();
      if (activeCredentialHandler === handleGoogleCallback) activeCredentialHandler = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCallback = async (response: GoogleCredentialResponse) => {
    recovery.close();
    setError(null);
    setRecoveryLink(null);
    setIsLoading(true);
    try {
      if (credentialActionRef.current) {
        await credentialActionRef.current(response.credential);
        return;
      }
      const res = await api.post('/auth/google/continue', {
        idToken: response.credential,
      });

      if (res.data && res.data.success) {
        const { accessToken } = res.data.data;
        const currentUser = await login(accessToken);
        if (!currentUser)
          setError('Your account was authenticated, but its profile could not be loaded. Please try again.');
      } else {
        setError(res.data.error || 'Google sign-in failed.');
      }
    } catch (err: unknown) {
      setError(
        isAxiosError(err) && !err.response
          ? 'We can’t reach the sign-in service. Check your connection and try again.'
          : getApiErrorMessage(err, 'Google authentication failed. Please try again.')
      );
      const errorCode = getApiErrorCode(err);
      if (errorCode === 'GOOGLE_LINK_REQUIRED') {
        setRecoveryLink({ href: '/login', label: 'Sign in with email' });
      } else if (errorCode === 'ACCOUNT_NOT_FOUND') {
        setRecoveryLink({ href: '/register', label: 'Create an account with Google' });
      } else if (errorCode === 'ACCOUNT_EXISTS') {
        setRecoveryLink({ href: '/login', label: 'Sign in instead' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    return null; // Don't render if Google OAuth not configured
  }

  return (
    <div className="w-full flex flex-col items-center gap-2">
      {error && (
        <div className="w-full rounded-xl border border-status-error-text/25 bg-status-error-bg/10 p-3 text-xs font-semibold text-status-error-text">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-status-error-text" />
            <span>{error}</span>
          </div>
          {recoveryLink ? (
            <Link href={recoveryLink.href} className="mt-2 inline-flex font-bold underline underline-offset-2">
              {recoveryLink.label}
            </Link>
          ) : null}
        </div>
      )}
      {recovery.embeddedBrowser ? (
        <div
          className="w-full rounded-xl border border-brand-border bg-brand-bgAlt p-3 text-sm text-brand-text"
          role="note"
        >
          <p>For Google sign-in, open this page in Chrome or Safari using this app’s menu.</p>
          <Button type="button" variant="secondary" size="sm" className="mt-2" onClick={recovery.showHelp}>
            How to open in your browser
          </Button>
        </div>
      ) : (
        <div
          className={`relative min-h-[40px] w-full ${disabled ? 'pointer-events-none opacity-50' : ''}`}
          aria-disabled={disabled}
        >
          {!isReady && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold text-[#61706b]">
              Loading Google sign-in…
            </span>
          )}
          <div
            ref={buttonRef}
            className={`flex w-full justify-center transition-opacity ${isReady ? 'opacity-100' : 'opacity-0'} ${isLoading ? 'pointer-events-none opacity-50' : ''}`}
          />
        </div>
      )}
      {!recovery.embeddedBrowser && (
        <button
          type="button"
          disabled={disabled || isLoading}
          onClick={recovery.showHelp}
          className="text-xs text-brand-muted underline underline-offset-2 hover:text-brand-text disabled:opacity-50"
        >
          Google window didn’t open?
        </button>
      )}
      {recovery.reason !== null && (
        <FloatingNotice
          kind="auth"
          onClose={recovery.close}
          title={recovery.reason === 'embedded-browser' ? 'Open in your browser' : 'Popup may be blocked'}
        >
          {recovery.reason === 'embedded-browser' ? (
            <>
              <p>
                Open KAINARA in Chrome or Safari to sign in with Google. In Messenger, Facebook or Instagram, use the
                app’s menu and choose “Open in browser”.
              </p>
              <Button type="button" size="sm" variant="secondary" onClick={() => void recovery.copyLink()}>
                Copy link
              </Button>
              <p className="break-all select-all text-brand-muted">{recovery.pageUrl}</p>
              {recovery.copyStatus && <p role="status">{recovery.copyStatus}</p>}
            </>
          ) : (
            <>
              <p>
                If Google sign-in didn’t open, allow pop-ups and redirects for this website in your browser’s site
                settings, then try again.
              </p>
              <p className="text-brand-muted">
                If a Google window is already open, continue there. You can also use email where available.
              </p>
            </>
          )}
        </FloatingNotice>
      )}
    </div>
  );
}

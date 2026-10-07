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
import { observeGoogleButtonLayout } from './google-button-layout';

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
  disabled?: boolean;
  onCredential?: (credential: string) => Promise<void>;
}

type GoogleCredentialResponse = { credential: string };

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
let googleScriptPromise: Promise<void> | null = null;
let initializedClientId: string | null = null;
let activeCredentialHandler: ((response: GoogleCredentialResponse) => void) | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (typeof window !== 'undefined' && window.google?.accounts?.id) return Promise.resolve();
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript && (existingScript.dataset.loaded === 'true' || window.google?.accounts?.id)) {
      resolve();
      return;
    }

    const script = existingScript ?? document.createElement('script');

    const handleLoad = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
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

export default function GoogleSignInButton({ disabled = false, onCredential }: GoogleSignInButtonProps) {
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
    let stopLayoutObserver: (() => void) | undefined;
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
          shape: 'pill',
          width: Math.min(buttonRef.current.clientWidth || 400, 400),
          text: 'continue_with',
          locale: 'en',
          logo_alignment: 'left',
          click_listener: recovery.startAttempt,
        });
        stopLayoutObserver = observeGoogleButtonLayout(
          buttonRef.current,
          () => {
            if (!cancelled) setIsReady(true);
          },
          () => {
            if (!cancelled) setError('Google sign-in is temporarily unavailable. Please use email instead.');
          }
        );
      })
      .catch(() => {
        if (!cancelled) setError('Google sign-in is temporarily unavailable. Please use email instead.');
      });

    return () => {
      cancelled = true;
      stopLayoutObserver?.();
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
          className={`relative h-[44px] w-full max-w-[400px] overflow-hidden rounded-full ${disabled || isLoading || !isReady ? 'pointer-events-none' : ''}`}
          aria-disabled={disabled || isLoading || !isReady}
          aria-busy={!isReady && !error}
        >
          {!isReady && !error && (
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-[2px] flex h-10 w-full items-center justify-center rounded-full border border-[#dadce0] bg-white px-4 text-sm font-medium text-[#3c4043] select-none shadow-[0_1px_2px_rgba(60,64,67,0.08)] pointer-events-none"
            >
              <div className="absolute left-4 flex items-center justify-center">
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.04h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 6-1.07 8.01-2.91l-3.88-3.04c-1.08.73-2.47 1.16-4.13 1.16-3.18 0-5.87-2.15-6.84-5.04H1.14v3.13C3.18 21.3 7.31 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.16 14.17c-.25-.73-.39-1.52-.39-2.33s.14-1.6.39-2.33V6.38H1.14C.41 7.82 0 9.44 0 11.84s.41 4.02 1.14 5.46l4.02-3.13z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.77c1.76 0 3.34.61 4.58 1.79l3.43-3.43C17.99 1.19 15.22 0 12 0 7.31 0 3.18 2.7 1.14 6.38l4.02 3.13c.97-2.89 3.66-5.04 6.84-5.04z"
                  />
                </svg>
              </div>
              <span className="font-sans text-sm font-medium tracking-[0.25px] text-[#3c4043]">
                Continue with Google
              </span>
            </div>
          )}
          <div
            ref={buttonRef}
            inert={disabled || isLoading || !isReady ? true : undefined}
            className={`flex w-full justify-center ${isReady ? 'visible' : 'invisible'}`}
          />
        </div>
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

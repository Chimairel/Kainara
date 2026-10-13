'use client';
import { toast } from 'sonner';
import { showSubmissionError } from '@/lib/submission-attempts';

import React, { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { useAuth } from '@/hooks/useAuth';
import api from '@/lib/axios';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error';

import FloatingNotice from '@/components/shared/FloatingNotice';
import Button from '@/components/ui/Button';
import { useGoogleSignInRecovery } from './useGoogleSignInRecovery';
import { isEmbeddedAppBrowser } from '@/lib/browser-environment';
import { loadGoogleIdentityServices } from './google-identity-services';
import { loadGoogleButtonFont } from './google-button-font';
import { useTheme } from '@/lib/context/ThemeContext';
import styles from './GoogleSignInButton.module.css';

/**
 * Google Identity Services "Sign in with Google" button.
 * Loads the GIS script, renders the button, and handles the callback.
 */

interface GoogleSignInButtonProps {
  disabled?: boolean;
  onCredential?: (credential: string) => Promise<void>;
}

type GoogleCredentialResponse = { credential: string };

let initializedClientId: string | null = null;
let activeCredentialHandler: ((response: GoogleCredentialResponse) => void) | null = null;

export default function GoogleSignInButton({ disabled = false, onCredential }: GoogleSignInButtonProps) {
  const { login } = useAuth();
  const { theme } = useTheme();
  const recovery = useGoogleSignInRecovery();
  const slotRef = useRef<HTMLDivElement>(null);
  const lightButtonRef = useRef<HTMLDivElement>(null);
  const darkButtonRef = useRef<HTMLDivElement>(null);
  const credentialActionRef = useRef(onCredential);
  const submitting = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    credentialActionRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
      return; // Google OAuth not configured — hide button silently
    }

    let cancelled = false;
    let sizeObserver: ResizeObserver | undefined;
    if (isEmbeddedAppBrowser(navigator.userAgent)) return;
    activeCredentialHandler = handleGoogleCallback;

    void Promise.all([
      loadGoogleIdentityServices(),
      // Font/CDN failures must not disable authentication. Google retains its own fallback.
      loadGoogleButtonFont().catch(() => undefined),
    ])
      .then(() => {
        if (cancelled || !window.google || !slotRef.current || !lightButtonRef.current || !darkButtonRef.current)
          return;

        if (initializedClientId !== clientId) {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response: GoogleCredentialResponse) => activeCredentialHandler?.(response),
            auto_select: false,
          });
          initializedClientId = clientId;
        }

        const slot = slotRef.current;
        const hosts = { outline: lightButtonRef.current, outline_dark: darkButtonRef.current };
        let previousWidth = 0;
        const renderButton = () => {
          if (cancelled || !window.google) return;
          const width = Math.min(400, Math.floor(slot.clientWidth) || 400);
          if (width === previousWidth) return;
          previousWidth = width;
          // Prepare both provider-owned appearances once. Theme switches must not
          // restart Google's native-control-to-iframe handoff or reload its fonts.
          const appearances = document.documentElement.classList.contains('dark')
            ? (['outline_dark', 'outline'] as const)
            : (['outline', 'outline_dark'] as const);
          for (const buttonTheme of appearances) {
            const host = hosts[buttonTheme];
            host.replaceChildren();
            window.google.accounts.id.renderButton(host, {
              locale: 'en',
              shape: 'pill',
              theme: buttonTheme,
              width,
              click_listener: recovery.startAttempt,
            });
          }
        };
        renderButton();
        if (typeof ResizeObserver !== 'undefined') {
          sizeObserver = new ResizeObserver(renderButton);
          sizeObserver.observe(slot);
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Google sign-in is temporarily unavailable. Please use email instead.');
      });

    return () => {
      cancelled = true;
      sizeObserver?.disconnect();
      recovery.stopAttempt();
      if (activeCredentialHandler === handleGoogleCallback) activeCredentialHandler = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogleCallback = async (response: GoogleCredentialResponse) => {
    recovery.close();
    if (submitting.current) return;
    submitting.current = true;
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
          toast.error('Your account was authenticated, but its profile could not be loaded. Please try again.');
      } else {
        toast.error(res.data.error || 'Google sign-in failed.');
      }
    } catch (err: unknown) {
      const code = getApiErrorCode(err);
      const action = code === 'ACCOUNT_NOT_FOUND' ? { label: 'Create an account', href: '/register' } :
        ['GOOGLE_LINK_REQUIRED', 'ACCOUNT_EXISTS'].includes(code ?? '') ? { label: 'Sign in with email', href: '/login' } : null;
      if (action) toast.error(getApiErrorMessage(err, 'Google authentication failed.'), {
        action: { label: action.label, onClick: () => window.location.assign(action.href) },
      });
      else showSubmissionError(err, isAxiosError(err) && !err.response ?
        'We can’t reach the sign-in service. Check your connection and try again.' : 'Google authentication failed. Please try again.');
    } finally {
      submitting.current = false;
      setIsLoading(false);
    }
  };

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    return null; // Don't render if Google OAuth not configured
  }

  return (
    <div className="w-full max-w-[400px] flex flex-col items-center gap-2">
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
        // Google briefly stacks its native button and iframe during replacement.
        // Keep that provider handoff inside its slot without restyling either control.
        <div
          ref={slotRef}
          style={{ lineHeight: 'normal' }}
          className={`relative h-[44px] w-full overflow-hidden ${disabled || isLoading ? 'pointer-events-none' : ''}`}
          aria-disabled={disabled || isLoading}
          aria-busy={isLoading}
        >
          <div
            ref={lightButtonRef}
            data-google-theme="light"
            aria-hidden={theme !== 'light'}
            inert={disabled || isLoading || theme !== 'light' ? true : undefined}
            className={`${styles.lightButton} absolute inset-x-0 top-0 flex w-full justify-center overflow-hidden rounded-full`}
          />
          <div
            ref={darkButtonRef}
            data-google-theme="dark"
            aria-hidden={theme !== 'dark'}
            inert={disabled || isLoading || theme !== 'dark' ? true : undefined}
            className={`${styles.darkButton} absolute inset-x-0 top-0 flex w-full justify-center overflow-hidden rounded-full`}
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

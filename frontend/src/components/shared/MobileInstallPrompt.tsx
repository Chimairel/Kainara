'use client';

import { useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import FloatingNotice from './FloatingNotice';
import { isEmbeddedAppBrowser, isPhoneBrowser } from '@/lib/browser-environment';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
type InstallationNavigator = Navigator & {
  standalone?: boolean;
  getInstalledRelatedApps?: () => Promise<{ platform: string; url?: string; id?: string }[]>;
};
const INSTALLED_KEY = 'kainara-install-confirmed';
function rememberInstalled(installed: boolean) {
  try {
    if (installed) localStorage.setItem(INSTALLED_KEY, 'true');
    else localStorage.removeItem(INSTALLED_KEY);
  } catch {
    /* Storage is optional; standalone detection still works. */
  }
}

export default function MobileInstallPrompt() {
  const [eligible, setEligible] = useState(false);
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState('');
  const promptRef = useRef<InstallPromptEvent | null>(null);
  const installationSignal = useRef(0);

  useEffect(() => {
    const nav = navigator as InstallationNavigator;
    const standalone = window.matchMedia('(display-mode: standalone)');
    if (standalone.matches || nav.standalone) {
      rememberInstalled(true);
      return;
    }
    if (!isPhoneBrowser(nav.userAgent) || isEmbeddedAppBrowser(nav.userAgent)) return;
    setIsIOS(/iPhone|iPod/i.test(nav.userAgent));
    let cancelled = false;
    let ready = false;
    let hint = false;
    try {
      hint = localStorage.getItem(INSTALLED_KEY) === 'true';
    } catch {
      /* No storage. */
    }
    setEligible(!hint);
    const updateAvailability = () =>
      setAvailable(
        ready &&
          document.hasFocus() &&
          document.visibilityState === 'visible' &&
          !document.querySelector('[role="dialog"], [data-floating-notice="auth"]')
      );
    const timer = window.setTimeout(() => {
      ready = true;
      updateAvailability();
    }, 1000);
    const observer = new MutationObserver(updateAvailability);
    observer.observe(document.body, { childList: true, subtree: true });
    const onInstalled = () => {
      installationSignal.current += 1;
      rememberInstalled(true);
      promptRef.current = null;
      setCanInstall(false);
      setEligible(false);
    };
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      installationSignal.current += 1;
      // A fresh native offer takes precedence over a remembered installation hint.
      rememberInstalled(false);
      setEligible(true);
      promptRef.current = event as InstallPromptEvent;
      setCanInstall(true);
    };
    const onDisplayModeChange = () => {
      if (standalone.matches) onInstalled();
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    standalone.addEventListener('change', onDisplayModeChange);
    window.addEventListener('focus', updateAvailability);
    window.addEventListener('blur', updateAvailability);
    document.addEventListener('visibilitychange', updateAvailability);
    if (nav.getInstalledRelatedApps) {
      const querySignal = installationSignal.current;
      // This optional API can distinguish installation from a normal browser visit.
      // Unsupported browsers use standalone detection and the user's explicit hint.
      void nav
        .getInstalledRelatedApps()
        .then((apps) => {
          if (cancelled || installationSignal.current !== querySignal) return;
          const origin = window.location.origin;
          const installed = apps.some(
            (app) => app.platform === 'webapp' && (app.id === `${origin}/` || app.url === `${origin}/manifest.json`)
          );
          rememberInstalled(installed);
          setEligible(!installed);
        })
        .catch(() => {
          /* Retain the fallback when browser detection is unavailable. */
        });
    }
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      standalone.removeEventListener('change', onDisplayModeChange);
      window.removeEventListener('focus', updateAvailability);
      window.removeEventListener('blur', updateAvailability);
      document.removeEventListener('visibilitychange', updateAvailability);
      promptRef.current = null;
    };
  }, []);

  const install = async () => {
    const event = promptRef.current;
    if (!event) return;
    promptRef.current = null;
    setCanInstall(false);
    setIsInstalling(true);
    setError('');
    try {
      await event.prompt();
      await event.userChoice;
      setDismissed(true);
    } catch {
      setError('The install prompt could not open. Use your browser menu to add KAINARA to your Home Screen.');
    } finally {
      setIsInstalling(false);
    }
  };

  if (!eligible || !available || dismissed) return null;
  return (
    <FloatingNotice kind="install" title="Install KAINARA" onClose={() => setDismissed(true)}>
      <p>
        {canInstall
          ? 'Add KAINARA to your Home Screen for quick access.'
          : isIOS
            ? 'In Safari, open the Share menu, choose “Add to Home Screen”, then tap Add.'
            : 'Open your browser’s menu (⋮) and choose “Install app” or “Add to Home Screen”.'}
      </p>
      <p className="text-brand-muted">An internet connection is needed to use your account.</p>
      {error && (
        <p role="alert" className="text-status-error-text">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {canInstall && (
          <Button type="button" size="sm" isLoading={isInstalling} onClick={() => void install()}>
            Install
          </Button>
        )}
        <button
          type="button"
          className="min-h-10 text-xs font-semibold text-brand-muted underline underline-offset-2"
          onClick={() => {
            installationSignal.current += 1;
            rememberInstalled(true);
            setEligible(false);
          }}
        >
          Already installed
        </button>
      </div>
    </FloatingNotice>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { isEmbeddedAppBrowser, isPhoneBrowser } from '@/lib/browser-environment';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'kainara-install-dismissed-at';
const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function rememberDismissal() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* Storage can be disabled. */
  }
}

export default function MobileInstallPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [error, setError] = useState('');
  const promptRef = useRef<InstallPromptEvent | null>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone = window.matchMedia('(display-mode: standalone)');
    if (
      !isPhoneBrowser(ua) ||
      isEmbeddedAppBrowser(ua) ||
      standalone.matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone
    )
      return;

    setIsIOS(/iPhone|iPod/i.test(ua));
    let dismissed = false;
    try {
      const lastDismissed = Number(localStorage.getItem(DISMISS_KEY));
      dismissed = lastDismissed > 0 && Date.now() - lastDismissed < REMIND_AFTER_MS;
    } catch {
      /* Still allow dismissal for this visit without storage. */
    }
    let timer: number | undefined;
    let installed = false;
    const showWhenAvailable = () => {
      if (installed || dismissed) return;
      // Don't stack this prompt over login, onboarding, or another active dialog.
      if (!document.hasFocus() || document.visibilityState !== 'visible' || document.querySelector('[role="dialog"]')) {
        timer = window.setTimeout(showWhenAvailable, 2000);
        return;
      }
      setIsOpen(true);
    };
    if (!dismissed) timer = window.setTimeout(showWhenAvailable, 8000);

    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      promptRef.current = event as InstallPromptEvent;
      setCanInstall(true);
    };
    const onInstalled = () => {
      installed = true;
      window.clearTimeout(timer);
      promptRef.current = null;
      setCanInstall(false);
      setIsOpen(false);
      rememberDismissal();
    };
    const onDisplayModeChange = () => {
      if (standalone.matches) onInstalled();
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    standalone.addEventListener('change', onDisplayModeChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      standalone.removeEventListener('change', onDisplayModeChange);
      promptRef.current = null;
    };
  }, []);

  const dismiss = () => {
    setIsOpen(false);
    rememberDismissal();
  };

  const install = async () => {
    const event = promptRef.current;
    if (!event) return;
    // The browser's install prompt is single-use and requires this user click.
    promptRef.current = null;
    setCanInstall(false);
    setIsInstalling(true);
    setError('');
    try {
      await event.prompt();
      await event.userChoice;
      dismiss();
    } catch {
      setError('The install prompt could not open. Use your browser menu to add KAINARA to your Home Screen.');
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={dismiss}
      size="sm"
      title="Add KAINARA to your Home Screen"
      description="Open your nutrition workspace from your phone’s Home Screen."
      footer={
        <>
          <Button type="button" variant="ghost" onClick={dismiss}>
            Not now
          </Button>
          {canInstall && (
            <Button type="button" isLoading={isInstalling} onClick={() => void install()}>
              Install KAINARA
            </Button>
          )}
          {!canInstall && (
            <Button type="button" onClick={dismiss}>
              Got it
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {canInstall ? (
          <p>Tap Install KAINARA, then confirm in your browser.</p>
        ) : isIOS ? (
          <p>
            In Safari, open the Share menu, choose “Add to Home Screen”, then tap Add. If you’re in another browser,
            open this page in Safari first.
          </p>
        ) : (
          <p>
            Open your browser’s menu (⋮) and choose “Install app” or “Add to Home Screen”. The available option depends
            on your browser.
          </p>
        )}
        <p className="text-brand-muted">
          KAINARA still needs an internet connection to load your account and save changes.
        </p>
        {error && (
          <p role="alert" className="text-status-error-text">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

export const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client?hl=en';

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

let pendingScript: Promise<void> | null = null;

/** One script owner for auth pages and any standalone credential-link control. */
export function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (pendingScript) return pendingScript;

  const promise = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (script?.dataset.googleState === 'failed') {
      script.remove();
      script = null;
    }
    const element = script ?? document.createElement('script');
    const cleanup = () => {
      clearTimeout(timeout);
      element.removeEventListener('load', loaded);
      element.removeEventListener('error', failed);
    };
    const failed = () => {
      cleanup();
      element.dataset.googleState = 'failed';
      reject(new Error('Google Identity Services failed to load.'));
    };
    const loaded = () => {
      if (!window.google?.accounts?.id) return failed();
      cleanup();
      element.dataset.googleState = 'loaded';
      resolve();
    };
    const timeout = setTimeout(failed, 15_000);
    element.addEventListener('load', loaded);
    element.addEventListener('error', failed);
    if (element.dataset.googleState === 'loaded') {
      loaded();
    } else if (!script) {
      element.src = GOOGLE_SCRIPT_SRC;
      element.async = true;
      document.head.appendChild(element);
    }
  });
  pendingScript = promise;
  void promise.catch(() => {
    if (pendingScript === promise) pendingScript = null;
  });
  return promise;
}

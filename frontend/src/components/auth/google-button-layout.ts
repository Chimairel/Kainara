/** Wait for the SDK's temporary button/frame handoff before exposing its UI. */
export function observeGoogleButtonLayout(host: HTMLElement, ready: () => void, unavailable: () => void) {
  let stopped = false;
  let frame = 0;
  let stableFrames = 0;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;
  let fallbackSettled = false;
  const embeddedLoads = new Map<HTMLIFrameElement, { loaded: boolean; onLoad: () => void }>();
  const nativeButtonFits = () => {
    const button = host.querySelector<HTMLElement>('button, [role="button"]');
    if (!button) return false;
    const bounds = host.getBoundingClientRect();
    const buttonBounds = button.getBoundingClientRect();
    return (
      bounds.height <= 44 &&
      buttonBounds.width > 0 &&
      buttonBounds.height > 0 &&
      buttonBounds.top >= bounds.top - 4 &&
      buttonBounds.bottom <= bounds.bottom + 4
    );
  };
  const fits = () => {
    if (!host.childElementCount) return false;
    const bounds = host.getBoundingClientRect();
    if (bounds.height > 44) return false;
    const iframe = host.querySelector('iframe');
    if (!iframe) return true;
    if (!embeddedLoads.get(iframe)?.loaded) return false;
    const embedded = iframe.getBoundingClientRect();
    // Google can retain its standard DOM button when the personalized frame is
    // rejected or blocked. A zero-sized frame does not invalidate that button.
    if (!embedded.width || !embedded.height) return fallbackSettled && nativeButtonFits();
    return (
      embedded.width > 0 &&
      embedded.height > 0 &&
      embedded.top >= bounds.top - 4 &&
      embedded.bottom <= bounds.bottom + 4
    );
  };
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(frame);
    clearTimeout(timeout);
    clearTimeout(fallbackTimer);
    mutations.disconnect();
    sizes.disconnect();
    embeddedLoads.forEach(({ onLoad }, iframe) => iframe.removeEventListener('load', onLoad));
  };
  const check = () => {
    if (stopped) return;
    cancelAnimationFrame(frame);
    stableFrames = 0;
    frame = requestAnimationFrame(confirm);
  };
  const confirm = () => {
    if (stopped || !fits()) return;
    if (++stableFrames < 2) {
      frame = requestAnimationFrame(confirm);
      return;
    }
    stop();
    ready();
  };
  const sizes = new ResizeObserver(check);
  const watchFrames = () => {
    host.querySelectorAll('iframe').forEach((iframe) => {
      if (embeddedLoads.has(iframe)) return;
      const state = {
        loaded: false,
        onLoad: () => {
          state.loaded = true;
          // A successful frame can post its dimensions just after load. Give
          // that handoff time to finish before choosing the standard button.
          fallbackSettled = false;
          clearTimeout(fallbackTimer);
          fallbackTimer = setTimeout(() => {
            fallbackSettled = true;
            check();
          }, 500);
          check();
        },
      };
      embeddedLoads.set(iframe, state);
      iframe.addEventListener('load', state.onLoad);
      sizes.observe(iframe);
    });
  };
  const mutations = new MutationObserver(() => {
    watchFrames();
    check();
  });
  const timeout = setTimeout(() => {
    const fallbackAvailable = nativeButtonFits();
    stop();
    if (fallbackAvailable) ready();
    else unavailable();
  }, 10000);
  sizes.observe(host);
  watchFrames();
  mutations.observe(host, { childList: true, subtree: true, attributes: true });
  check();
  return stop;
}

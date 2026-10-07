/** Wait for the SDK's temporary button/frame handoff before exposing its UI. */
export function observeGoogleButtonLayout(host: HTMLElement, ready: () => void, unavailable: () => void) {
  let stopped = false;
  let frame = 0;
  let stableFrames = 0;
  const embeddedLoads = new Map<HTMLIFrameElement, { loaded: boolean; onLoad: () => void }>();
  const fits = () => {
    if (!host.childElementCount) return false;
    const bounds = host.getBoundingClientRect();
    if (bounds.height > 44) return false;
    const iframe = host.querySelector('iframe');
    if (!iframe) return true;
    if (!embeddedLoads.get(iframe)?.loaded) return false;
    const embedded = iframe.getBoundingClientRect();
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
    stop();
    unavailable();
  }, 10000);
  sizes.observe(host);
  watchFrames();
  mutations.observe(host, { childList: true, subtree: true, attributes: true });
  check();
  return stop;
}

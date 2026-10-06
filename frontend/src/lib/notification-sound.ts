export const NOTIFICATION_SOUND_KEY = 'kainara:notification-sound';
export const NOTIFICATION_SOUND_URL = '/sounds/notification.mp3';

type InboxItem = { id: string; isRead: boolean; createdAt: string };

/** Establish a quiet baseline, then detect new unread items rather than count changes. */
export function createNotificationTracker() {
  let initialized = false;
  let newestTime = -Infinity;
  const seen = new Set<string>();
  return (notifications: readonly InboxItem[]) => {
    let hasNewUnread = false;
    const previousTime = newestTime;
    for (const notification of notifications) {
      const time = Date.parse(notification.createdAt);
      if (initialized && !seen.has(notification.id) && !notification.isRead && time >= previousTime)
        hasNewUnread = true;
      seen.add(notification.id);
      if (Number.isFinite(time)) newestTime = Math.max(newestTime, time);
    }
    initialized = true;
    while (seen.size > 500) seen.delete(seen.values().next().value!);
    return hasNewUnread;
  };
}

/** No audio work until a gesture; blocked/unsupported audio never affects the inbox. */
export function createNotificationAudio() {
  let context: AudioContext | undefined;
  let buffer: AudioBuffer | undefined;
  let loading: Promise<void> | undefined;
  const controller = new AbortController();
  const sources = new Set<AudioBufferSourceNode>();
  let disposed = false;
  let lastPlayedAt = -Infinity;
  let retryLoadAt = -Infinity;
  let pendingUntil: number | undefined;
  const stop = () => {
    pendingUntil = undefined;
    for (const source of sources) {
      try {
        source.stop();
      } catch {
        /* A source may already have ended during cleanup. */
      }
      source.disconnect();
    }
    sources.clear();
  };
  const flush = () => {
    if (pendingUntil === undefined) return;
    if (disposed || Date.now() > pendingUntil || document.visibilityState === 'hidden') {
      pendingUntil = undefined;
      return;
    }
    if (!buffer || context?.state !== 'running') return;
    pendingUntil = undefined;
    if (sources.size || Date.now() - lastPlayedAt < 3000) return;
    try {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      gain.gain.value = 0.6;
      source.connect(gain);
      gain.connect(context.destination);
      source.onended = () => {
        sources.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      source.start();
      sources.add(source);
      lastPlayedAt = Date.now();
    } catch {
      /* Device interruptions must not interrupt account updates. */
    }
  };
  const resume = () => {
    // Safari can be interrupted after a tab switch, not only suspended.
    try {
      if (context && context.state !== 'running' && context.state !== 'closed')
        void context
          .resume()
          .then(flush)
          .catch(() => {});
    } catch {
      /* Some devices reject resume synchronously; leave the inbox usable. */
    }
  };
  const load = () => {
    if (disposed || buffer || loading || !context || Date.now() < retryLoadAt) return;
    const audioContext = context;
    loading = fetch(NOTIFICATION_SOUND_URL, { signal: controller.signal, cache: 'force-cache' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Notification sound unavailable');
        const decoded = await audioContext.decodeAudioData(await response.arrayBuffer());
        if (!disposed) {
          buffer = decoded;
          flush();
        }
      })
      .catch(() => {
        retryLoadAt = Date.now() + 3000;
        /* A later gesture or new alert can retry a transient download/decode failure. */
      })
      .finally(() => {
        loading = undefined;
      });
  };
  return {
    unlock(retryNow = false) {
      if (disposed) return;
      try {
        const Audio =
          window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Audio) return;
        if (!context || context.state === 'closed') {
          context = new Audio();
          context.onstatechange = flush;
        }
        if (retryNow) retryLoadAt = -Infinity;
        resume();
        load();
        flush();
      } catch {
        /* Sound is optional; notifications and unread counts still work. */
      }
    },
    play() {
      // Retain one recent chime during loading/resume; never replay old or unactivated alerts.
      if (disposed || !context || document.visibilityState === 'hidden') return;
      pendingUntil = Date.now() + 10000;
      resume();
      load();
      flush();
    },
    stop,
    dispose() {
      disposed = true;
      controller.abort();
      stop();
      if (context && context.state !== 'closed') void context.close().catch(() => {});
    },
  };
}

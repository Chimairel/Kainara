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
  const stop = () => {
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
  return {
    unlock() {
      if (disposed) return;
      try {
        const Audio =
          window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Audio) return;
        context ??= new Audio();
        if (context.state === 'suspended') void context.resume().catch(() => {});
        const audioContext = context;
        loading ??= fetch(NOTIFICATION_SOUND_URL, { signal: controller.signal, cache: 'force-cache' })
          .then(async (response) => {
            if (!response.ok) throw new Error('Notification sound unavailable');
            const decoded = await audioContext.decodeAudioData(await response.arrayBuffer());
            if (!disposed) buffer = decoded;
          })
          .catch(() => {
            /* A missing/unsupported file must not affect the inbox. */
          });
      } catch {
        /* Sound is optional; notifications and unread counts still work. */
      }
    },
    play() {
      if (disposed || !buffer || context?.state !== 'running' || sources.size || Date.now() - lastPlayedAt < 3000)
        return;
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

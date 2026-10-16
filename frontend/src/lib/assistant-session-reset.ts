export const ASSISTANT_SESSION_PREFIX = 'kainara:nara:session:v1:';

/** Lightweight logout integration; do not load the chat parser in public auth screens. */
export function clearAssistantSessions() {
  try {
    for (const item of Object.keys(sessionStorage)) if (item.startsWith(ASSISTANT_SESSION_PREFIX)) sessionStorage.removeItem(item);
  } catch { /* Storage can be unavailable. */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('kainara:nara-session-cleared'));
}

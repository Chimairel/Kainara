import api from '@/lib/axios';

/** Submitted text only. Best-effort delivery must not delay a local, free answer. */
export async function recordLocalAssistantMessage(requestKey: string, message: string) {
  try {
    await api.post('/user/assistant/activity', { requestKey, message }, { skipTransientRetry: true, timeout: 10000 });
  } catch {
    /* Offline help stays available; unsent records are not queued or replayed. */
  }
}

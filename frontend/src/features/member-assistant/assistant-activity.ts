import api, { type ApiRequestConfig } from '@/lib/axios';

/** Submitted text only. Best-effort delivery must not delay a local, free answer. */
export async function recordLocalAssistantMessage(requestKey: string, message: string) {
  try {
    const config: ApiRequestConfig = { skipTransientRetry: true, timeout: 10000 };
    await api.post('/user/assistant/activity', { requestKey, message }, config);
  } catch {
    /* Offline help stays available; unsent records are not queued or replayed. */
  }
}

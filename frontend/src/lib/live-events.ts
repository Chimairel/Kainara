export const LIVE_UPDATE_EVENT = 'kainara:live-update';
/** SSE frames may be split across network chunks. Ignore payloads and heartbeats. */
export function createLiveEventParser(refresh: () => void) {
  let buffer = '';
  return (chunk: string) => {
    buffer += chunk.replace(/\r/g, '');
    let boundary: number;
    while ((boundary = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (/^event: (?:refresh|connected)$/m.test(frame)) refresh();
    }
    // Malformed/unbounded upstream data must never accumulate indefinitely.
    if (buffer.length > 65536) buffer = '';
  };
}

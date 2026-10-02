import { describe, expect, it, vi } from 'vitest';
import { createLiveEventParser } from './live-events';
describe('live stream framing', () => {
  it('handles split frames, heartbeats and CRLF without consuming private event data', () => {
    const refresh = vi.fn();
    const parse = createLiveEventParser(refresh);
    parse('event: connec');
    parse('ted\r\ndata: {}\r\n\r\n: keep-alive\n\n');
    expect(refresh).not.toHaveBeenCalled();
    parse('event: refresh\ndata: {}\n');
    expect(refresh).not.toHaveBeenCalled();
    parse('\nevent: unrelated\ndata: ignored\n\n');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

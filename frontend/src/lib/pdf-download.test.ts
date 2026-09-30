import { Blob as NodeBlob } from 'node:buffer';
import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadPdf } from './pdf-download';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get } }));

describe('PDF response handling', () => {
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(), revokeObjectURL: vi.fn() });
    mocks.get.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    new NodeBlob(['{"error":"Review is still required"}'], { type: 'application/json; charset=utf-8' }),
    new NodeBlob(['<html>Error</html>'], { type: 'application/pdf' }),
    new NodeBlob([], { type: 'application/pdf' }),
  ])('does not save JSON, corrupt or empty responses', async (data) => {
    mocks.get.mockResolvedValue({ data });
    await expect(downloadPdf('/pdf', 'file.pdf')).rejects.toThrow();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('surfaces a server JSON error from a failed blob request', async () => {
    mocks.get.mockRejectedValue({
      response: { data: new NodeBlob(['{"error":"Review is still required"}'], { type: 'application/json' }) },
    });
    await expect(downloadPdf('/pdf', 'file.pdf')).rejects.toThrow('Review is still required');
  });

  it('explains a bounded request timeout', async () => {
    mocks.get.mockRejectedValue(new AxiosError('timeout', 'ECONNABORTED'));
    await expect(downloadPdf('/pdf', 'file.pdf')).rejects.toThrow('PDF preparation took too long');
  });
});

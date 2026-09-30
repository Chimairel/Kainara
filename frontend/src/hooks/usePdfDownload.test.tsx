import { Blob as NodeBlob } from 'node:buffer';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePdfDownload } from './usePdfDownload';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get } }));

function Fixture({ owner = 'user' }: { owner?: string }) {
  const { isDownloadingPdf, startPdfDownload } = usePdfDownload(owner);
  return (
    <button
      disabled={isDownloadingPdf}
      onClick={() => void startPdfDownload('/user/grocery/pdf', 'Grocery.pdf').catch(() => undefined)}
    >
      {isDownloadingPdf ? 'Preparing PDF' : 'Download PDF'}
    </button>
  );
}

describe('shared PDF download lifecycle', () => {
  beforeEach(() => {
    vi.stubGlobal('Blob', NodeBlob);
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test-pdf'), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    mocks.get.mockReset();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each(['/user/grocery/pdf', '/user/nutrition-report/pdf'])(
    'settles the button after downloading %s and defers URL cleanup',
    async (path) => {
      let resolve!: (value: unknown) => void;
      mocks.get.mockReturnValue(
        new Promise((r) => {
          resolve = r;
        })
      );
      function Page() {
        const { isDownloadingPdf, startPdfDownload } = usePdfDownload('user');
        return (
          <button disabled={isDownloadingPdf} onClick={() => void startPdfDownload(path, 'Report.pdf')}>
            {isDownloadingPdf ? 'Preparing PDF' : 'Download PDF'}
          </button>
        );
      }
      render(<Page />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('button', { name: 'Preparing PDF' })).toBeDisabled();
      expect(mocks.get).toHaveBeenCalledTimes(1);
      vi.useFakeTimers();
      await act(async () => resolve({ data: new NodeBlob(['%PDF-1.7\nfixture'], { type: 'application/pdf' }) }));
      expect(screen.getByRole('button', { name: 'Download PDF' })).not.toBeDisabled();
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
      expect(document.querySelector('a[download]')).toBeNull();
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1000));
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-pdf');
    }
  );

  it('settles a failed request without saving an error response as PDF', async () => {
    mocks.get.mockRejectedValue({
      response: { data: new NodeBlob(['{"error":"List is stale"}'], { type: 'application/json' }) },
    });
    render(<Fixture />);
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('button')).toHaveTextContent('Download PDF'));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it.each(['unmount', 'owner change'])('cancels on %s and does not download a late response', async (action) => {
    let resolve!: (value: unknown) => void;
    mocks.get.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );
    const { unmount, rerender } = render(<Fixture />);
    fireEvent.click(screen.getByRole('button'));
    const signal = mocks.get.mock.calls[0][1].signal as AbortSignal;
    if (action === 'unmount') unmount();
    else rerender(<Fixture owner="another-user" />);
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ data: new NodeBlob(['%PDF-1.7'], { type: 'application/pdf' }) }));
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    if (action === 'owner change') expect(screen.getByRole('button')).not.toBeDisabled();
  });
});

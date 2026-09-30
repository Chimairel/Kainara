import { isAxiosError, type AxiosRequestConfig } from 'axios';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';

async function responseError(data: unknown): Promise<string | null> {
  if (!(data instanceof Blob) || !data.type.toLowerCase().includes('json')) return null;
  try {
    const parsed = JSON.parse(await data.text()) as { error?: unknown };
    return typeof parsed.error === 'string' && parsed.error.trim() ? parsed.error : null;
  } catch {
    return null;
  }
}

/** Fetch through the authenticated client and hand the completed PDF to the browser. */
export async function downloadPdf(url: string, filename: string, config: AxiosRequestConfig = {}): Promise<void> {
  let file: Blob;
  try {
    const response = await api.get<Blob>(url, { ...config, responseType: 'blob' });
    const message = await responseError(response.data);
    if (message) throw new Error(message);
    file = response.data;
    if (!(file instanceof Blob) || (await file.slice(0, 5).text()) !== '%PDF-') {
      throw new Error('The server did not return a valid PDF. Please try again.');
    }
  } catch (error) {
    const data = (error as { response?: { data?: unknown } })?.response?.data;
    const message = await responseError(data);
    if (message) throw new Error(message);
    if (isAxiosError(error) && ['ECONNABORTED', 'ETIMEDOUT'].includes(error.code ?? '')) {
      throw new Error('PDF preparation took too long. Please try again.');
    }
    if (error instanceof Error && !isAxiosError(error)) throw error;
    throw new Error(getApiErrorMessage(error, 'Could not download the PDF. Please try again.'));
  }

  // Logout, owner changes and navigation away must not save a late response.
  if (config.signal?.aborted) return;
  const fileURL = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = fileURL;
  anchor.download = filename.replace(/[\\/:*?"<>|\u0000-\u001F]/g, '_');
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    // Give the browser time to start reading before releasing the object URL.
    window.setTimeout(() => URL.revokeObjectURL(fileURL), 1000);
  }
}

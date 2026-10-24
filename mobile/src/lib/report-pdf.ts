import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import { api } from './client';
import { resolveApiUrl } from './policies';

export async function shareReportPdf(version: number) {
  return sharePdf(`/user/nutrition-report/pdf?version=${version}`, 'report');
}
export async function shareGroceryPdf(cycleId: string) {
  return sharePdf(`/user/grocery/pdf?cycleId=${encodeURIComponent(cycleId)}`, 'groceries');
}
async function sharePdf(endpoint: string, name: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('File sharing is not available on this device.');
  await api.request('/user/profile'); // refresh access before the authenticated file transfer
  const base = resolveApiUrl(process.env.EXPO_PUBLIC_API_URL, __DEV__);
  const target = new File(Paths.cache, `kainara-${name}-${Crypto.randomUUID()}.pdf`);
  try {
    const downloaded = await File.downloadFileAsync(`${base}${endpoint}`, target, {
      headers: { Authorization: `Bearer ${api.accessToken}` },
    });
    await Sharing.shareAsync(downloaded.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  } finally {
    if (target.exists) target.delete();
  }
}

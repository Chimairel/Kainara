import { safeExternalUrl } from './policies';
export function webUrl(path: string) {
  const base = safeExternalUrl(process.env.EXPO_PUBLIC_WEB_URL ?? '');
  if (!base) throw new Error('Set EXPO_PUBLIC_WEB_URL to your staging website for browser handoffs.');
  return new URL(path, base).toString();
}

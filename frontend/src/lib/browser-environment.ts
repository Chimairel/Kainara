export function isEmbeddedAppBrowser(userAgent: string): boolean {
  return /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram/i.test(userAgent);
}

export function isPhoneBrowser(userAgent: string): boolean {
  return /iPhone|iPod|Android.*Mobile/i.test(userAgent);
}

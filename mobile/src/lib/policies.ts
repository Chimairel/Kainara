import type { MemberProfile, Meal } from './contracts.ts';

export function resolveApiUrl(value: string | undefined, development: boolean): string {
  if (!value?.trim()) throw new Error('Set EXPO_PUBLIC_API_URL to your local or staging API before signing in.');
  const url = new URL(value.trim());
  if (url.username || url.password || url.search || url.hash || !/^https?:$/.test(url.protocol))
    throw new Error('Use an API URL without credentials, query parameters or fragments.');
  const host = url.hostname.toLowerCase();
  const local =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '10.0.2.2' ||
    /^192\.168\.\d+\.\d+$/.test(host) ||
    /^10\.\d+\.\d+\.\d+$/.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host);
  if (url.protocol !== 'https:' && !(development && local))
    throw new Error('Use HTTPS for remote APIs. HTTP is allowed only for local development.');
  if (url.pathname.replace(/\/$/, '') !== '/api') throw new Error('The API URL must end with /api.');
  return url.toString().replace(/\/$/, '');
}

export function memberGate(profile: MemberProfile): 'verify' | 'onboarding' | 'report' | 'ready' | 'staff' {
  if (profile.role !== 'USER') return 'staff';
  if (!profile.emailVerified) return 'verify';
  if (!profile.onboardingDone || !profile.tosAccepted || profile.onboardingStatus?.acceptedCurrentConsent === false)
    return 'onboarding';
  // The API resolves the selected planning version, which can differ from the
  // latest proposal. Never override that authoritative result with the newest
  // report's display metadata, and never derive readiness from JWT claims.
  if (typeof profile.reportAcknowledged === 'boolean') return profile.reportAcknowledged ? 'ready' : 'report';
  const report = profile.nutritionReport;
  if (
    !report?.acknowledgedAt ||
    report.isStale !== false ||
    typeof report.profileRevision !== 'number' ||
    report.profileRevision !== profile.userProfile?.revision
  )
    return 'report';
  return 'ready';
}

export function manilaDate(value: string | number | Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}
export function dateLabel(value: string): string {
  return new Date(value.length === 10 ? `${value}T12:00:00+08:00` : value).toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}
export function mealDone(meal: Meal) {
  return meal.mealLogs?.some((log) => log.status === 'DONE') === true;
}
export function finite(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
export function serializeQuestion(question: string, ai: boolean) {
  return `${ai ? '/ai ' : ''}${question.trim()}`;
}
export function validateQuestion(question: string, ai: boolean) {
  if (!question.trim()) return 'Write your question first.';
  if (serializeQuestion(question, ai).length > 1000)
    return 'Keep your question within 1,000 characters, including /ai.';
  return null;
}
export function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

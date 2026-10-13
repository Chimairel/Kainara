import type { AxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { getApiErrorMessage } from './api-error';

type AttemptConfig = AxiosRequestConfig & { _attempt?: { key: string; lease: symbol } };
type State = { lease?: symbol; until: number };
const attempts = new Map<string, State>();
const handled = new WeakSet<object>();
const protectedPath = /^(?:\/auth\/(?:login|register|google(?:\/(?:continue|login|register))?|forgot-password|reset-password|verify-email|resend-verification)|\/support\/requests|\/admin\/support\/[^/]+\/replies)$/;

function scope(config: AttemptConfig): string | null {
  if (typeof window === 'undefined' || config.method?.toLowerCase() !== 'post' || !protectedPath.test(config.url ?? '')) return null;
  let owner = 'visitor';
  // Cosmetic partition only. Server authentication and limits remain authoritative.
  try {
    const token = String(config.headers?.Authorization ?? '').replace(/^Bearer /, '');
    owner = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).userId || owner;
  } catch { /* Anonymous forms do not have an access token. */ }
  // Keep a connection-wide wait for public forms; changing the email cannot bypass it.
  return `${owner}:${config.url}`;
}

function waitDescription(seconds: number): string {
  return seconds < 60 ? `Try again in ${seconds} seconds.` : `Try again in ${Math.ceil(seconds / 60)} minutes.`;
}

export function beginSubmission(config: AttemptConfig) {
  const key = scope(config);
  if (!key) return;
  for (const [oldKey, value] of attempts) if (!value.lease && value.until <= Date.now()) attempts.delete(oldKey);
  const current = attempts.get(key);
  if (current?.lease || (current && current.until > Date.now())) {
    const error = new Error(current.lease ? 'Your request is already being sent.' : 'Please wait before trying again.');
    handled.add(error);
    toast.info(error.message, { id: `attempt:${key}`, description: current.lease ? undefined : waitDescription(Math.ceil((current.until - Date.now()) / 1000)) });
    throw error;
  }
  const lease = Symbol('submission');
  attempts.set(key, { lease, until: 0 });
  config._attempt = { key, lease };
}

export function finishSubmission(config?: AttemptConfig, error?: { response?: { status?: number; data?: { retryAfterSeconds?: number }; headers?: Record<string, unknown> } }) {
  const lease = config?._attempt;
  if (!lease || attempts.get(lease.key)?.lease !== lease.lease) return;
  delete config!._attempt;
  if (config?.signal?.aborted) { attempts.delete(lease.key); return; }
  if (error?.response?.status === 429) {
    const reported = Number(error.response.data?.retryAfterSeconds ?? error.response.headers?.['retry-after']);
    const seconds = Number.isFinite(reported) && reported > 0 ? Math.min(86400, Math.ceil(reported)) : 60;
    attempts.set(lease.key, { until: Date.now() + seconds * 1000 });
    handled.add(error);
    toast.error(getApiErrorMessage(error, 'Too many attempts.'), { id: `attempt:${lease.key}`, description: waitDescription(seconds) });
  } else attempts.delete(lease.key);
}

export function showSubmissionError(error: unknown, fallback: string) {
  if (typeof error === 'object' && error !== null && handled.has(error)) return;
  toast.error(getApiErrorMessage(error, fallback));
}

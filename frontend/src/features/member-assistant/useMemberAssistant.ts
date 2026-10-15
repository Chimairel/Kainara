'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api, { type ApiRequestConfig } from '@/lib/axios';
import { getApiErrorCode, getApiErrorMessage } from '@/lib/api-error';
import type { AssistantAction, AssistantAllowance, AssistantInput, AssistantResult, AssistantReply, ChatEntry } from './types';
import { assistantStaticReply } from './assistant-information.generated';
import { readAssistantSession, saveAssistantSession, type AssistantSession } from '@/lib/assistant-session';

export const ASSISTANT_BALANCE_MAX_AGE_MS = 60_000;

/** Account-keyed memory plus a bounded, expiring copy in this tab's sessionStorage. */
export function useMemberAssistant(ready: boolean, ownerId?: string) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [allowance, setAllowance] = useState<AssistantAllowance | null>(null);
  const [pending, setPending] = useState<AssistantInput | null>(null);
  const [failed, setFailed] = useState<AssistantInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryStatus, setRecoveryStatus] = useState<string | null>(null);
  const initialized = useRef(false);
  const storageBlocked = useRef(false);
  const createdAt = useRef(Date.now());
  const restoreRecovery = useRef<string | null>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const balance = useRef<{ value: AssistantAllowance | null; checkedAt: number }>({ value: null, checkedAt: 0 });
  const balanceRevision = useRef(0);
  const statusRequest = useRef<{ controller: AbortController; promise: Promise<void> } | null>(null);
  const recoveryController = useRef<AbortController | null>(null);
  const recovering = useRef(false);
  const snapshot = useRef<AssistantSession | null>(null);
  snapshot.current = ownerId ? { version: 1, owner: ownerId, createdAt: createdAt.current, open, draft, messages, pending, recoveryKey } : null;

  useEffect(() => {
    if (!ready || !ownerId || initialized.current) return;
    initialized.current = true;
    const saved = readAssistantSession(ownerId);
    if (saved) {
      createdAt.current = saved.createdAt;
      setMessages(saved.messages.map(item => ({ ...item, restored: true })));
      setDraft(saved.draft); setOpen(saved.open); setPending(saved.pending); setRecoveryKey(saved.recoveryKey);
      restoreRecovery.current = saved.recoveryKey;
    }
    setHydrated(true);
  }, [ready, ownerId]);
  useEffect(() => {
    if (hydrated && !storageBlocked.current && snapshot.current) saveAssistantSession(snapshot.current);
  }, [hydrated, messages, draft, open, pending, recoveryKey]);
  useEffect(() => {
    const clear = () => {
      storageBlocked.current = true;
      controller.current?.abort(); recoveryController.current?.abort();
      setMessages([]); setDraft(''); setPending(null); setRecoveryKey(null); setRecoveryStatus(null); setOpen(false);
    };
    window.addEventListener('kainara:nara-session-cleared', clear);
    return () => window.removeEventListener('kainara:nara-session-cleared', clear);
  }, []);

  const refreshAllowance = useCallback((force = false) => {
    if (!ready || !alive.current) return Promise.resolve();
    if (statusRequest.current) return statusRequest.current.promise;
    const cached = balance.current;
    if (!force && cached.value && Date.now() - cached.checkedAt < ASSISTANT_BALANCE_MAX_AGE_MS
      && Date.now() < Date.parse(cached.value.resetsAt)) return Promise.resolve();
    const abort = new AbortController();
    const revision = balanceRevision.current;
    const promise = api.get('/user/assistant', { signal: abort.signal }).then(response => {
      if (!alive.current || abort.signal.aborted || revision !== balanceRevision.current) return;
      setEnabled(Boolean(response.data.data?.enabled));
      const value = response.data.data?.allowance ?? null;
      balance.current = { value, checkedAt: Date.now() };
      setAllowance(value);
    }).catch(() => { /* Keep the last display; server admission still checks current credits. */ })
      .finally(() => { if (statusRequest.current?.controller === abort) statusRequest.current = null; });
    statusRequest.current = { controller: abort, promise };
    return promise;
  }, [ready]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false; controller.current?.abort(); statusRequest.current?.controller.abort(); recoveryController.current?.abort();
      statusRequest.current = null;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    void refreshAllowance();
    const membershipChanged = () => {
      balanceRevision.current++;
      balance.current.checkedAt = 0;
      statusRequest.current?.controller.abort();
      statusRequest.current = null;
      void refreshAllowance(true);
    };
    window.addEventListener('kainara:membership-updated', membershipChanged);
    return () => { window.removeEventListener('kainara:membership-updated', membershipChanged); };
  }, [ready, refreshAllowance]);

  useEffect(() => {
    if (!open || !allowance) return;
    const remaining = Date.parse(allowance.resetsAt) - Date.now();
    const timer = remaining > 0 && remaining <= 2_147_483_647
      ? window.setTimeout(() => { void refreshAllowance(); }, remaining + 50) : undefined;
    const resume = () => { if (!document.hidden) void refreshAllowance(); };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearTimeout(timer); window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [open, allowance, refreshAllowance]);

  const request = async (input: AssistantInput) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true); setError(null); setFailed(null);
    const abort = new AbortController();
    controller.current = abort;
    if (input.allowAi) {
      setRecoveryKey(input.requestKey); setPending(null);
      // Persist the key before starting paid work. Refresh may then recover it via GET, never replay POST.
      if (!storageBlocked.current && snapshot.current) saveAssistantSession({ ...snapshot.current, recoveryKey: input.requestKey, pending: null });
    }
    try {
      const config: ApiRequestConfig = { signal: abort.signal, skipTransientRetry: true, timeout: 90000 };
      const response = await api.post('/user/assistant/messages', input, config);
      if (!alive.current) return;
      const result = response.data.data as AssistantResult;
      balanceRevision.current++;
      balance.current = { value: result.allowance, checkedAt: Date.now() };
      setAllowance(result.allowance);
      if (result.confirmationRequired) { setPending({ ...input, requestKey: result.requestKey }); return; }
      setPending(null); setRecoveryKey(null); setRecoveryStatus(null);
      setMessages(current => [...current.slice(-39), {
        id: `${input.requestKey}:reply`, role: 'assistant', text: result.reply.text, reply: result.reply, createdAt: Date.now(),
      }]);
    } catch (cause) {
      if (!alive.current || abort.signal.aborted) return;
      // These admission rejections cannot have created work for this request key.
      // Keep uncertain delivery/provider failures recoverable, but do not trap free help
      // behind a receipt that will never exist after a known pre-admission rejection.
      if (['ASSISTANT_DISABLED', 'ASSISTANT_TOO_FAST', 'ASSISTANT_CREDITS_EXHAUSTED'].includes(getApiErrorCode(cause) ?? '')) {
        setRecoveryKey(null); setRecoveryStatus(null);
      }
      setError(getApiErrorMessage(cause, 'The assistant could not respond. Please try again.'));
      setFailed(input);
      setPending(null);
      void refreshAllowance(true);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const checkRecovery = useCallback(async (key = recoveryKey) => {
    if (!key || !ready || recovering.current || inFlight.current) return;
    recovering.current = true; setRecoveryStatus('Checking your previous request…'); setBusy(true);
    const abort = new AbortController(); recoveryController.current = abort;
    try {
      const response = await api.get(`/user/assistant/requests/${key}`, { signal: abort.signal, skipTransientRetry: true } as ApiRequestConfig);
      if (!alive.current || abort.signal.aborted) return;
      const result = response.data.data as { status: 'SUCCEEDED' | 'RUNNING' | 'FAILED' | 'EXPIRED' | 'NOT_FOUND'; reply?: AssistantReply; completedAt?: string; allowance: AssistantAllowance };
      balanceRevision.current++; balance.current = { value: result.allowance, checkedAt: Date.now() }; setAllowance(result.allowance);
      setError(null); setFailed(null);
      if (result.status === 'SUCCEEDED' && result.reply) {
        const reply = result.reply;
        setMessages(current => current.some(item => item.id === `${key}:reply`) ? current : [...current.slice(-39), {
          id: `${key}:reply`, role: 'assistant', text: reply.text, reply, restored: true,
          createdAt: result.completedAt && Number.isFinite(Date.parse(result.completedAt)) ? Date.parse(result.completedAt) : Date.now(),
        }]);
        setRecoveryKey(null); setRecoveryStatus(null);
      } else if (result.status === 'RUNNING' || result.status === 'NOT_FOUND') {
        setRecoveryStatus(result.status === 'RUNNING'
          ? 'Your previous request is still running. Check its reply shortly; this will not call AI again.'
          : 'No saved reply was found yet. Check again before retrying your question; no new AI request was started.');
      } else if (result.status === 'FAILED' || result.status === 'EXPIRED') {
        setRecoveryKey(null); setRecoveryStatus(null);
        setMessages(current => [...current.slice(-39), { id: crypto.randomUUID(), role: 'assistant', createdAt: Date.now(),
          text: 'Your previous request did not complete. No credit was spent. Send your question again if you want to try; I’ll ask for confirmation first.' }]);
      } else throw new Error('Unconfirmed recovery response');
    } catch {
      if (alive.current && !abort.signal.aborted) setRecoveryStatus('I couldn’t check your previous reply. Check again when your connection is available; no new AI request was started.');
    } finally {
      recovering.current = false;
      if (alive.current && !abort.signal.aborted) setBusy(false);
    }
  }, [recoveryKey, ready]);
  useEffect(() => {
    if (!enabled || !hydrated || !restoreRecovery.current) return;
    const key = restoreRecovery.current; restoreRecovery.current = null;
    void checkRecovery(key);
  }, [enabled, hydrated, checkRecovery]);

  const send = (action?: AssistantAction, label?: string) => {
    const text = (label ?? draft).trim();
    if (!text || text.length > 1000 || inFlight.current || pending || recoveryKey) return;
    const input: AssistantInput = {
      requestKey: crypto.randomUUID(), message: text, action, allowAi: false,
      context: messages.slice(-6).map(item => ({ role: item.role, content: item.text.slice(0, 500) })),
    };
    setMessages(current => [...current.slice(-39), { id: input.requestKey, role: 'user', text, createdAt: Date.now() }]);
    setDraft('');
    const information = assistantStaticReply(text, action);
    if (information) {
      setError(null); setFailed(null);
      setMessages(current => [...current.slice(-39), {
        id: `${input.requestKey}:reply`, role: 'assistant', text: information.text,
        reply: { ...information, source: 'SYSTEM', creditsUsed: 0 },
        createdAt: Date.now(),
      }]);
      return;
    }
    void request(input);
  };

  return {
    enabled: enabled && ready, open, setOpen, draft, setDraft, messages, allowance, pending, error, busy, failed,
    recoveryKey, recoveryStatus, checkRecovery: () => { void checkRecovery(); },
    send,
    confirm: () => { if (pending && !inFlight.current) void request({ ...pending, allowAi: true }); },
    cancel: () => {
      setPending(null);
      setMessages(current => [...current.slice(-39), { id: crypto.randomUUID(), role: 'assistant', text: 'Cancelled. No AI credit was used.', createdAt: Date.now() }]);
    },
    retry: () => {
      if (recoveryKey) { void checkRecovery(); return; }
      if (!failed || inFlight.current) return;
      // Recheck before a new provider attempt; retries never silently spend a credit.
      void request({ ...failed, allowAi: false });
    },
    newChat: () => {
      if (inFlight.current || recovering.current) return;
      setMessages([]); setDraft(''); setError(null); setPending(null); setFailed(null);
      setRecoveryKey(null); setRecoveryStatus(null); createdAt.current = Date.now();
    },
    refreshAllowance,
  };
}
export type MemberAssistantModel = ReturnType<typeof useMemberAssistant>;

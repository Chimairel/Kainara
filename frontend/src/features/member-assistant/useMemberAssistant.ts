'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api, { type ApiRequestConfig } from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { AssistantAction, AssistantAllowance, AssistantInput, AssistantResult, ChatEntry } from './types';
import { assistantStaticReply } from './assistant-information.generated';

export const ASSISTANT_BALANCE_MAX_AGE_MS = 60_000;

/** Kept in the authenticated layout only; no health/chat text enters browser storage. */
export function useMemberAssistant(ready: boolean) {
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [allowance, setAllowance] = useState<AssistantAllowance | null>(null);
  const [pending, setPending] = useState<AssistantInput | null>(null);
  const [failed, setFailed] = useState<AssistantInput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const balance = useRef<{ value: AssistantAllowance | null; checkedAt: number }>({ value: null, checkedAt: 0 });
  const balanceRevision = useRef(0);
  const statusRequest = useRef<{ controller: AbortController; promise: Promise<void> } | null>(null);

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
      alive.current = false; controller.current?.abort(); statusRequest.current?.controller.abort();
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
    try {
      const config: ApiRequestConfig = { signal: abort.signal, skipTransientRetry: true, timeout: 90000 };
      const response = await api.post('/user/assistant/messages', input, config);
      if (!alive.current) return;
      const result = response.data.data as AssistantResult;
      balanceRevision.current++;
      balance.current = { value: result.allowance, checkedAt: Date.now() };
      setAllowance(result.allowance);
      if (result.confirmationRequired) { setPending({ ...input, requestKey: result.requestKey }); return; }
      setPending(null);
      setMessages(current => [...current.slice(-39), {
        id: `${input.requestKey}:reply`, role: 'assistant', text: result.reply.text, reply: result.reply,
      }]);
    } catch (cause) {
      if (!alive.current || abort.signal.aborted) return;
      setError(getApiErrorMessage(cause, 'The assistant could not respond. Please try again.'));
      setFailed(input);
      setPending(null);
      void refreshAllowance(true);
    } finally {
      inFlight.current = false;
      if (alive.current) setBusy(false);
    }
  };

  const send = (action?: AssistantAction, label?: string) => {
    const text = (label ?? draft).trim();
    if (!text || text.length > 1000 || inFlight.current || pending) return;
    const input: AssistantInput = {
      requestKey: crypto.randomUUID(), message: text, action, allowAi: false,
      context: messages.slice(-6).map(item => ({ role: item.role, content: item.text.slice(0, 500) })),
    };
    setMessages(current => [...current.slice(-39), { id: input.requestKey, role: 'user', text }]);
    setDraft('');
    const information = assistantStaticReply(text, action);
    if (information) {
      setError(null); setFailed(null);
      setMessages(current => [...current.slice(-39), {
        id: `${input.requestKey}:reply`, role: 'assistant', text: information.text,
        reply: { ...information, source: 'SYSTEM', creditsUsed: 0 },
      }]);
      return;
    }
    void request(input);
  };

  return {
    enabled: enabled && ready, open, setOpen, draft, setDraft, messages, allowance, pending, error, busy, failed,
    send,
    confirm: () => { if (pending && !inFlight.current) void request({ ...pending, allowAi: true }); },
    cancel: () => {
      setPending(null);
      setMessages(current => [...current, { id: crypto.randomUUID(), role: 'assistant', text: 'Cancelled. No AI credit was used.' }]);
    },
    retry: () => {
      if (!failed || inFlight.current) return;
      // Recheck before a new provider attempt; retries never silently spend a credit.
      void request({ ...failed, allowAi: false });
    },
    newChat: () => {
      if (inFlight.current) return;
      setMessages([]); setDraft(''); setError(null); setPending(null); setFailed(null);
    },
    refreshAllowance,
  };
}
export type MemberAssistantModel = ReturnType<typeof useMemberAssistant>;

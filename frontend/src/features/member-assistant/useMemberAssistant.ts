'use client';

import { useEffect, useRef, useState } from 'react';
import api, { type ApiRequestConfig } from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { AssistantAction, AssistantAllowance, AssistantInput, AssistantResult, ChatEntry } from './types';

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

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; controller.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!ready) return;
    const abort = new AbortController();
    void api.get('/user/assistant', { signal: abort.signal }).then(response => {
      if (abort.signal.aborted) return;
      setEnabled(Boolean(response.data.data?.enabled));
      setAllowance(response.data.data?.allowance ?? null);
    }).catch(() => { /* A disabled/unavailable extension never blocks the member portal. */ });
    return () => abort.abort();
  }, [ready]);

  const refreshAllowance = () => {
    void api.get('/user/assistant').then(response => {
      if (alive.current) setAllowance(response.data.data?.allowance ?? null);
    }).catch(() => {});
  };

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
      refreshAllowance();
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

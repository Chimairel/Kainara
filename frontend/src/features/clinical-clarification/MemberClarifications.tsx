'use client';
import { useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import ClarificationFormCard from './ClarificationFormCard';
import type { ClarificationForm, ClarificationWorkspace } from './types';

export default function MemberClarifications({
  workspace,
  onUpdated,
}: {
  workspace?: ClarificationWorkspace;
  onUpdated: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const requestRef = useRef<{ payload: string; key: string } | null>(null);
  const retryKey = (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    if (requestRef.current?.payload !== serialized)
      requestRef.current = { payload: serialized, key: crypto.randomUUID() };
    return requestRef.current.key;
  };
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  if (!workspace?.enabled || !workspace.forms.length) return null;
  async function answer(form: ClarificationForm, answers: Record<string, string>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/user/clinical-clarifications/${form.id}/answers`, {
        answers,
        requestKey: retryKey({
          id: form.id,
          profileRevision: form.profileRevision,
          expectedResponseId: form.responses.at(-1)?.id ?? null,
          answers,
        }),
        expectedResponseId: form.responses.at(-1)?.id ?? null,
        profileRevision: form.profileRevision,
        scopeKey: form.scopeKey,
      });
      await onUpdated();
      setMessage('Answers submitted. An RND will review them; your profile has not changed.');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Your answers could not be submitted.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="RND clarification forms">
      <h2 className="font-display text-xl font-bold">Questions from your RND</h2>
      {error && (
        <p role="alert" className="text-sm text-status-error-text">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-brand-green">
          {message}
        </p>
      )}
      {workspace.forms.map((form) => (
        <ClarificationFormCard
          key={form.id}
          form={form}
          mode="member"
          disabled={busy}
          onAnswer={(answers) => answer(form, answers)}
        />
      ))}
    </section>
  );
}

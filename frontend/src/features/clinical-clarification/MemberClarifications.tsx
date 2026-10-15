'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import { useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import ClarificationFormCard from './ClarificationFormCard';
import Button from '@/components/ui/Button';
import type { ClarificationForm, ClarificationWorkspace } from './types';

export default function MemberClarifications({
  workspace,
  onUpdated,
  selectedId,
  embedded = false,
  disabled = false,
}: {
  workspace?: ClarificationWorkspace;
  onUpdated: () => Promise<void>;
  selectedId?: string;
  embedded?: boolean;
  disabled?: boolean;
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
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  if (!workspace?.enabled || !workspace.forms.length) return null;
  async function refreshSavedAnswers() {
    setBusy(true);
    try {
      await onUpdated();
      setNeedsRefresh(false);
      setError(null);
    } catch {
      setError('Answers were submitted, but the updated record could not be loaded. Reload the saved answers.');
    } finally {
      setBusy(false);
    }
  }
  async function answer(form: ClarificationForm, answers: Record<string, string>) {
    if (disabled || busy || needsRefresh) return;
    setFeedbackId(form.id);
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
      setMessage(form.purpose === 'MEAL'
        ? 'Meal answer submitted. Your RND will review it; this has not approved or rejected the meal.'
        : 'Answers submitted. An RND will review them; your profile has not changed.');
      setNeedsRefresh(true);
      await refreshSavedAnswers();
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Your answers could not be submitted.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="RND clarification forms">
      {!embedded && <h2 className="font-display text-xl font-bold">Questions from your RND</h2>}
      {error && (needsRefresh || selectedId === undefined || selectedId === feedbackId) && (
        <FeedbackNotice variant="inline">{error}</FeedbackNotice>
      )}
      {message && (selectedId === undefined || selectedId === feedbackId) && (
        <p role="status" className="text-sm text-brand-green">
          {message}
        </p>
      )}
      {needsRefresh && (
        <Button disabled={busy} onClick={() => void refreshSavedAnswers()}>
          Reload saved answers
        </Button>
      )}
      {workspace.forms.map((form) => (
        <div key={form.id} hidden={selectedId !== undefined && selectedId !== form.id}>
          <ClarificationFormCard
            form={form}
            embedded={embedded}
            mode="member"
            disabled={disabled || busy || needsRefresh}
            onAnswer={(answers) => answer(form, answers)}
          />
        </div>
      ))}
    </section>
  );
}

'use client';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import NativeSelect from '@/components/ui/NativeSelect';
import ClarificationFormCard from './ClarificationFormCard';
import type { ClarificationForm, ClarificationQuestion, ClarificationWorkspace } from './types';

export type DraftQuestion = { id: string; label: string; type: 'TEXT' | 'CHOICE'; required: boolean; choices: string };
const newQuestion = (): DraftQuestion => ({
  id: crypto.randomUUID(),
  label: '',
  type: 'TEXT',
  required: true,
  choices: '',
});
export function useRndClarificationDraft(caseKey: string) {
  const [title, setTitle] = useState('Profile clarification');
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  useEffect(() => {
    setTitle('Profile clarification');
    setQuestions([]);
  }, [caseKey]);
  return { title, setTitle, questions, setQuestions };
}

export default function RndClarifications({
  userId,
  profileRevision,
  scopeKey,
  workspace,
  canWrite,
  onUpdated,
  draft,
  showForms = true,
  showComposer = true,
  publishTarget,
  onInvalidated,
}: {
  userId: string;
  profileRevision: number;
  scopeKey: string;
  workspace?: ClarificationWorkspace;
  canWrite: boolean;
  onUpdated: () => Promise<void>;
  draft?: ReturnType<typeof useRndClarificationDraft>;
  showForms?: boolean;
  showComposer?: boolean;
  publishTarget?: { url: string; expectedContextKey: string };
  onInvalidated?: (cause: unknown) => boolean;
}) {
  const internalDraft = useRndClarificationDraft(`${userId}:${profileRevision}:${scopeKey}`);
  const { title, setTitle, questions, setQuestions } = draft ?? internalDraft;
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
  useEffect(() => {
    setError(null);
    setMessage(null);
  }, [userId, profileRevision, scopeKey]);
  if (!workspace?.enabled) return null;
  const updateQuestion = (id: string, patch: Partial<DraftQuestion>) =>
    setQuestions((items) => items.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  async function publish() {
    if (!canWrite || busy) return;
    const prepared: ClarificationQuestion[] = questions.map((q) =>
      q.type === 'TEXT'
        ? { id: q.id, label: q.label.trim(), type: 'TEXT', required: q.required }
        : {
            id: q.id,
            label: q.label.trim(),
            type: 'CHOICE',
            required: q.required,
            options: q.choices
              .split('\n')
              .map((v) => v.trim())
              .filter(Boolean),
          }
    );
    if (
      title.trim().length < 3 ||
      !prepared.length ||
      !prepared.some((q) => q.required) ||
      prepared.some(
        (q) =>
          q.label.length < 3 ||
          (q.type === 'CHOICE' &&
            (q.options.length < 2 || q.options.length > 8 || new Set(q.options).size !== q.options.length))
      )
    ) {
      setError(
        'Add a title, questions of at least three characters, at least one required question, and two to eight distinct choices where applicable.'
      );
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(publishTarget?.url ?? `/nutritionist/profile-reviews/${userId}/clarifications`, {
        profileRevision,
        scopeKey,
        title,
        questions: prepared,
        ...(publishTarget ? { expectedContextKey: publishTarget.expectedContextKey } : {}),
        requestKey: retryKey({ userId, profileRevision, scopeKey, title, questions: prepared, publishTarget }),
      });
      setQuestions([]);
      await onUpdated();
      setMessage('Questions sent to Health details. The profile is unchanged and confirmation waits for resolution.');
    } catch (cause) {
      if (onInvalidated?.(cause)) return;
      setError(getApiErrorMessage(cause, 'Questions could not be sent.'));
    } finally {
      setBusy(false);
    }
  }
  async function resolve(form: ClarificationForm, rationale: string) {
    if (!canWrite || busy || publishTarget) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.post(`/nutritionist/profile-reviews/${userId}/clarifications/${form.id}/resolve`, {
        profileRevision,
        scopeKey,
        responseId: form.responses.at(-1)!.id,
        rationale,
      });
      await onUpdated();
      setMessage(
        'Clarification resolved against the reviewed response. Profile confirmation remains a separate decision.'
      );
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Clarification could not be resolved.'));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="space-y-4" aria-label="Profile clarification work">
      <h3 className="font-display text-lg font-bold">Clarification forms</h3>
      <p className="text-xs text-brand-muted">
        Forms stay with this member through claim handoffs. Published questions cannot be overwritten; send a follow-up
        form when needed.
      </p>
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
      {showForms &&
        workspace.forms.map((form) => (
          <ClarificationFormCard
            key={form.id}
            form={form}
            mode="reviewer"
            disabled={busy || !canWrite}
            onResolve={publishTarget ? undefined : (rationale) => resolve(form, rationale)}
          />
        ))}
      {showComposer && (
        <Card className="space-y-3 p-4">
          <h4 className="font-bold">Send specific questions</h4>
          {publishTarget && <p className="text-xs text-brand-muted">Sending questions pauses this member’s meal reviews. Review answers and any profile corrections in the Profile queue.</p>}
          {!canWrite && <p className="text-xs text-brand-muted">{publishTarget ? 'Claim this meal to send questions.' : 'Claim this profile to send or resolve questions.'}</p>}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void publish();
            }}
            className="space-y-3"
          >
            <fieldset disabled={!canWrite || busy} className="space-y-3">
              <label className="block text-sm">
                Form title
                <input
                  value={title}
                  minLength={3}
                  maxLength={160}
                  required
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-3"
                />
              </label>
              {questions.map((q, index) => (
                <div key={q.id} className="space-y-3 rounded-xl border border-brand-border p-3">
                  <label className="block text-sm">
                    Question {index + 1}
                    <textarea
                      value={q.label}
                      required
                      minLength={3}
                      maxLength={500}
                      rows={2}
                      onChange={(event) => updateQuestion(q.id, { label: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-3"
                    />
                  </label>
                  <label className="block text-sm">
                    Answer type
                    <NativeSelect
                      value={q.type}
                      onChange={(event) => updateQuestion(q.id, { type: event.target.value as DraftQuestion['type'] })}
                      className="mt-1 w-full"
                    >
                      <option value="TEXT">Text</option>
                      <option value="CHOICE">Single choice</option>
                    </NativeSelect>
                  </label>
                  {q.type === 'CHOICE' && (
                    <label className="block text-sm">
                      Choices, one per line
                      <textarea
                        value={q.choices}
                        required
                        maxLength={1000}
                        rows={3}
                        onChange={(event) => updateQuestion(q.id, { choices: event.target.value })}
                        className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-3"
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(event) => updateQuestion(q.id, { required: event.target.checked })}
                    />
                    Required
                  </label>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setQuestions((items) => items.filter((item) => item.id !== q.id))}
                  >
                    Remove question
                  </Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={questions.length >= 12}
                  onClick={() => setQuestions((items) => [...items, newQuestion()])}
                >
                  Add question
                </Button>
                <Button type="submit" disabled={!questions.length}>
                  Send questions
                </Button>
              </div>
            </fieldset>
          </form>
        </Card>
      )}
    </section>
  );
}

'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import { toast } from 'sonner';

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
export function useRndClarificationDraft(caseKey: string, initialTitle = 'Profile clarification') {
  const [title, setTitle] = useState(initialTitle);
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const requestRef = useRef<{ payload: string; key: string } | null>(null);
  useEffect(() => {
    setTitle(initialTitle);
    setQuestions([]);
    requestRef.current = null;
  }, [caseKey, initialTitle]);
  return { title, setTitle, questions, setQuestions, requestRef };
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
  embedded = false,
  onBusyChange,
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
  publishTarget?: { url: string; expectedContextKey: string; purpose?: 'PROFILE' | 'MEAL' };
  onInvalidated?: (cause: unknown) => boolean;
  embedded?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  const internalDraft = useRndClarificationDraft(`${userId}:${profileRevision}:${scopeKey}`);
  const { title, setTitle, questions, setQuestions } = draft ?? internalDraft;
  const [busy, setBusy] = useState(false);
  const requestRef = (draft ?? internalDraft).requestRef;
  const retryKey = (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    if (requestRef.current?.payload !== serialized)
      requestRef.current = { payload: serialized, key: crypto.randomUUID() };
    return requestRef.current.key;
  };
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setError(null);
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
    onBusyChange?.(true);
    setError(null);
    try {
      await api.post(publishTarget?.url ?? `/nutritionist/profile-reviews/${userId}/clarifications`, {
        profileRevision,
        scopeKey,
        title,
        questions: prepared,
        ...(publishTarget ? { expectedContextKey: publishTarget.expectedContextKey, purpose: publishTarget.purpose ?? 'PROFILE' } : {}),
        requestKey: retryKey({ userId, profileRevision, scopeKey, title, questions: prepared, publishTarget }),
      });
      setQuestions([]);
      await onUpdated();
      toast.success(publishTarget?.purpose === 'MEAL'
        ? 'Meal question sent. Waiting for the member’s response.'
        : 'Profile question sent to Health details.');
    } catch (cause) {
      if (onInvalidated?.(cause)) return;
      setError(getApiErrorMessage(cause, 'Questions could not be sent.'));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  async function resolve(form: ClarificationForm, rationale: string) {
    if (!canWrite || busy || (publishTarget && form.purpose !== 'MEAL')) return;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      await api.post(publishTarget && form.purpose === 'MEAL'
        ? `${publishTarget.url}/${form.id}/resolve`
        : `/nutritionist/profile-reviews/${userId}/clarifications/${form.id}/resolve`, {
        profileRevision,
        scopeKey,
        responseId: form.responses.at(-1)!.id,
        rationale,
        ...(publishTarget ? { expectedContextKey: publishTarget.expectedContextKey } : {}),
      });
      await onUpdated();
      toast.success('Clarification resolved.');
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Clarification could not be resolved.'));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <section className="space-y-4" aria-label={publishTarget?.purpose === 'MEAL' ? 'Meal question work' : 'Profile clarification work'}>
      {showComposer && <p className="text-sm text-brand-muted">
        {publishTarget?.purpose === 'MEAL'
          ? 'Ask about this meal, its portion or ingredients. Only this meal will wait for a response; the approved profile stays unchanged.'
          : publishTarget ? 'Ask about the member’s health profile. Sending reopens profile review and pauses their meal cases until the profile is confirmed again.'
          : 'Ask about this member’s profile. Responses are reviewed here before profile confirmation.'}
      </p>}
      {!embedded && <h3 className="font-display text-lg font-bold">Clarification forms</h3>}
      {!embedded && <p className="text-xs text-brand-muted">
        Forms stay with this member through claim handoffs. Published questions cannot be overwritten; send a follow-up
        form when needed.
      </p>}
      {error && <FeedbackNotice variant="inline">{error}</FeedbackNotice>}
      {showForms &&
        workspace.forms.map((form) => (
          <ClarificationFormCard
            key={form.id}
            form={form}
            mode="reviewer"
            embedded={embedded}
            disabled={busy || !canWrite}
            onResolve={publishTarget && form.purpose !== 'MEAL' ? undefined : (rationale) => resolve(form, rationale)}
          />
        ))}
      {showComposer && (
        <Card className={embedded ? 'space-y-3 rounded-none border-0 p-0 shadow-none sm:rounded-none' : 'space-y-3 p-4'}>
          <h4 className="font-bold">Send specific questions</h4>
          {!canWrite && (
            <p className="text-xs text-brand-muted">
              {publishTarget
                ? 'Claim this meal to send questions.'
                : 'Claim this profile to send or resolve questions.'}
            </p>
          )}
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

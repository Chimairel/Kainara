'use client';
import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import NativeSelect from '@/components/ui/NativeSelect';
import type { ClarificationForm } from './types';

/** Shared member-answer and RND-review surface. Callers own authorization and API mutations. */
export default function ClarificationFormCard({
  form,
  mode,
  disabled = false,
  onAnswer,
  onResolve,
}: {
  form: ClarificationForm;
  mode: 'member' | 'reviewer';
  disabled?: boolean;
  onAnswer?: (answers: Record<string, string>) => Promise<void>;
  onResolve?: (rationale: string) => Promise<void>;
}) {
  const latest = form.responses.at(-1);
  const [answers, setAnswers] = useState<Record<string, string>>(latest?.answers ?? {});
  const [rationale, setRationale] = useState('');
  useEffect(() => {
    setAnswers(latest?.answers ?? {});
    setRationale('');
  }, [form.id, latest?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const readOnly = mode !== 'member' || form.status === 'SUPERSEDED' || form.status === 'RESOLVED';
  const statusLabel = {
    AWAITING_MEMBER: 'Awaiting your response',
    ANSWERED: 'Awaiting RND review',
    RESOLVED: 'Resolved by an RND',
    SUPERSEDED: 'Historical — profile changed',
  }[form.status];
  return (
    <Card className="space-y-4 p-4 sm:p-5">
      <header>
        <h3 className="font-display text-lg font-bold">{form.title}</h3>
        <p className="mt-1 text-xs text-brand-muted">
          {form.authorName}, RND · Profile revision {form.profileRevision} ·{' '}
          {mode === 'reviewer' && form.status === 'AWAITING_MEMBER' ? 'Awaiting member response' : statusLabel}
        </p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!readOnly && !disabled) void onAnswer?.(answers);
        }}
        className="space-y-3"
      >
        <fieldset disabled={disabled || readOnly} className="space-y-3">
          {form.questions.map((question) => (
            <label key={question.id} className="block text-sm">
              {question.label}
              {question.required ? ' *' : ' (optional)'}
              {question.type === 'CHOICE' ? (
                <NativeSelect
                  value={answers[question.id] ?? ''}
                  required={question.required}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                  className="mt-1 w-full"
                >
                  <option value="">Select an answer</option>
                  {question.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <textarea
                  value={answers[question.id] ?? ''}
                  required={question.required}
                  maxLength={2000}
                  rows={3}
                  onChange={(event) => setAnswers((current) => ({ ...current, [question.id]: event.target.value }))}
                  className="mt-1 block w-full rounded-xl border border-brand-border bg-brand-surface p-3 disabled:opacity-80"
                />
              )}
            </label>
          ))}
        </fieldset>
        {!readOnly && (
          <Button type="submit" disabled={disabled}>
            {latest ? 'Submit updated answers' : 'Submit answers'}
          </Button>
        )}
      </form>
      {latest && (
        <p className="text-xs text-brand-muted">
          Submitted response version {latest.version}. Answers do not change the member profile automatically.
        </p>
      )}
      {form.responses.length > 1 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold">Previous responses</summary>
          {form.responses.slice(0, -1).map((response) => (
            <div key={response.id} className="mt-3 space-y-2 border-t border-brand-border pt-3">
              <strong>Response version {response.version}</strong>
              {form.questions.map((q) => (
                <p key={q.id}>
                  <strong>{q.label}: </strong>
                  {response.answers[q.id] || 'Not answered'}
                </p>
              ))}
            </div>
          ))}
        </details>
      )}
      {form.resolution && (
        <p className="whitespace-pre-wrap text-sm">
          <strong>{form.resolution.reviewerName}, RND: </strong>
          {form.resolution.rationale}
        </p>
      )}
      {mode === 'reviewer' && form.status === 'ANSWERED' && onResolve && (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!disabled && rationale.trim().length >= 10) void onResolve(rationale);
          }}
        >
          <label className="block text-sm">
            Resolution notes
            <textarea
              required
              minLength={10}
              maxLength={2000}
              disabled={disabled}
              rows={3}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              className="mt-1 block w-full rounded-xl border border-brand-border bg-brand-surface p-3"
            />
          </label>
          <Button type="submit" disabled={disabled || rationale.trim().length < 10}>
            Resolve clarification
          </Button>
          <p className="text-xs text-brand-muted">
            Resolve only after reviewing the latest answers. This does not confirm the profile or approve a meal.
          </p>
        </form>
      )}
    </Card>
  );
}

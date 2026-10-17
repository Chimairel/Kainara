'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import { normalizeAssistantQuestion } from '@/features/member-assistant/assistant-information.generated';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import NativeSelect from '@/components/ui/NativeSelect';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import WorkspaceTable from '@/components/shared/WorkspaceTable';

type Answer = {
  question: string;
  variants: string[];
  answer: string;
  category: 'APP_HELP' | 'NUTRITION' | 'CONVERSATION';
};
const topicHelp: Record<Answer['category'], string> = {
  APP_HELP:
    'Explain KAINARA features and workflows. Personal account and meal-status checks keep their existing replies.',
  NUTRITION:
    'Explain general food and nutrition concepts. Personal medical clearance and treatment advice are not supported.',
  CONVERSATION:
    'Write a social or celebration reply for these exact phrases. This does not expand what /ai can answer.',
};
type Entry = {
  id: string;
  revision: number;
  draft: Answer | null;
  published: Answer | null;
  publishedAt: string | null;
};
const blank = (): Answer => ({ question: '', variants: [], answer: '', category: 'APP_HELP' });
const fieldStyle =
  'w-full rounded-xl border border-brand-border bg-brand-bgAlt px-4 py-3 text-base text-brand-text placeholder:text-brand-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green disabled:opacity-50';

export default function NaraAnswersWorkspace() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<Entry | null>(null);
  const [draft, setDraft] = useState<Answer>(blank);
  const [variants, setVariants] = useState('');
  const [search, setSearch] = useState('');
  const [testQuestion, setTestQuestion] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const questionRef = useRef<HTMLInputElement>(null);
  const requestInFlight = useRef(false);
  const payload = {
    ...draft,
    variants: variants
      .split('\n')
      .map((value) => value.trim())
      .filter(Boolean),
  };
  const dirty = JSON.stringify(payload) !== JSON.stringify(selected?.draft ?? blank());
  const publishedCount = entries.filter((entry) => entry.published).length;

  const load = useCallback(async () => {
    setError(null);
    try {
      setEntries((await api.get('/admin/nara-answers')).data.data);
      setLoaded(true);
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not load Nara answers. Try reloading.'));
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  function select(entry: Entry | null) {
    if (busy) return;
    if (dirty && !window.confirm('Discard the unsaved question and answer?')) return;
    setSelected(entry);
    setDraft(entry?.draft ?? blank());
    setVariants(entry?.draft?.variants.join('\n') ?? '');
    setError(null);
    setNotice(null);
    setTestQuestion('');
    setPreview(null);
    questionRef.current?.focus();
  }
  async function mutate(action: 'save' | 'publish' | 'unpublish' | 'delete') {
    if (requestInFlight.current || !loaded) return;
    if (action === 'delete' && !window.confirm('Delete this Nara answer? It will stop matching immediately.')) return;
    requestInFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      let next: Entry | null;
      if (action === 'save') {
        next = selected
          ? (await api.patch(`/admin/nara-answers/${selected.id}`, { revision: selected.revision, draft: payload }))
              .data.data
          : (await api.post('/admin/nara-answers', payload)).data.data;
      } else {
        if (!selected) return;
        next = (await api.post(`/admin/nara-answers/${selected.id}/${action}`, { revision: selected.revision })).data
          .data;
      }
      setEntries((current) =>
        next
          ? [next, ...current.filter((entry) => entry.id !== next.id)]
          : current.filter((entry) => entry.id !== selected?.id)
      );
      setSelected(next);
      setDraft(next?.draft ?? blank());
      setVariants(next?.draft?.variants.join('\n') ?? '');
      setPreview(null);
      setNotice(
        action === 'save'
          ? 'Draft saved. Publish it when the answer is ready.'
          : action === 'publish'
            ? 'Published. Nara can now answer these exact questions without AI credits.'
            : action === 'unpublish'
              ? 'Unpublished. The draft is kept for editing.'
              : 'Answer deleted.'
      );
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not update this answer. Your edits are still here.'));
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }
  function testDraft() {
    const key = normalizeAssistantQuestion(testQuestion);
    setPreview(
      key && [payload.question, ...payload.variants].some((text) => normalizeAssistantQuestion(text) === key)
        ? payload.answer || 'Write an answer first.'
        : 'No exact match. Add this wording as an alternative question if it has the same meaning.'
    );
  }
  const filtered = entries.filter((entry) =>
    [entry.draft?.question, entry.published?.question, ...(entry.draft?.variants ?? [])].some((value) =>
      value?.toLowerCase().includes(search.toLowerCase())
    )
  );
  return (
    <div className="portal-page space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-text">Nara answers</h1>
          <p className="mt-2 max-w-2xl text-sm text-brand-muted">
            Write instant replies for KAINARA help, nutrition questions and Nara conversations. Published answers use no
            AI credits.
          </p>
          <p className="mt-2 text-sm text-brand-muted">
            {publishedCount} published · {entries.length} of 100 answers
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              if (dirty && !window.confirm('Discard unsaved changes and reload?')) return;
              setSelected(null);
              setDraft(blank());
              setVariants('');
              void load();
            }}
            disabled={busy}
          >
            Reload answers
          </Button>
          <Button onClick={() => select(null)} disabled={busy || !loaded}>
            New answer
          </Button>
        </div>
      </header>
      {error && <FeedbackNotice>{error}</FeedbackNotice>}
      {notice && <FeedbackNotice tone="success">{notice}</FeedbackNotice>}
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.2fr)]">
        <section className="min-w-0 space-y-4" aria-label="Saved answers">
          <Input
            label="Search questions"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a saved question…"
          />
          {!loaded && !error ? (
            <p role="status" className="text-sm text-brand-muted">
              Loading answers…
            </p>
          ) : (
            <WorkspaceTable
              label="Nara answer library"
              rows={filtered}
              rowKey={(entry) => entry.id}
              emptyMessage={
                search ? 'No questions match your search.' : 'No answers yet. Write your first question in the editor.'
              }
              columns={[
                {
                  key: 'question',
                  header: 'Question',
                  cell: (entry) => (
                    <button
                      type="button"
                      disabled={busy}
                      aria-pressed={selected?.id === entry.id}
                      onClick={() => select(entry)}
                      className="min-h-11 w-full rounded-lg py-2 text-left font-semibold text-brand-green underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
                    >
                      {entry.draft?.question ?? entry.published?.question ?? 'Untitled answer'}
                    </button>
                  ),
                },
                {
                  key: 'state',
                  header: 'Status',
                  cell: (entry) => (
                    <span className="whitespace-nowrap">
                      {entry.published
                        ? JSON.stringify(entry.draft) === JSON.stringify(entry.published)
                          ? 'Published'
                          : 'Unpublished edits'
                        : 'Draft'}
                    </span>
                  ),
                },
              ]}
            />
          )}
        </section>
        <section
          aria-labelledby="nara-answer-editor"
          className="min-w-0 rounded-2xl border border-brand-border bg-brand-surface p-4 sm:p-6"
        >
          <h2 id="nara-answer-editor" className="font-display text-xl font-bold">
            {selected ? 'Edit answer' : 'New answer'}
          </h2>
          <form
            className="mt-5 space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              void mutate('save');
            }}
          >
            <div>
              <label htmlFor="nara-answer-category" className="mb-2 block text-sm font-semibold">
                Topic
              </label>
              <NativeSelect
                id="nara-answer-category"
                value={draft.category}
                disabled={busy}
                aria-describedby="nara-topic-help"
                onChange={(event) =>
                  setDraft((current) => ({ ...current, category: event.target.value as Answer['category'] }))
                }
              >
                <option value="APP_HELP">KAINARA app help</option>
                <option value="NUTRITION">General nutrition education</option>
                <option value="CONVERSATION">Nara conversation</option>
              </NativeSelect>
              <p id="nara-topic-help" className="mt-2 text-sm text-brand-muted">
                {topicHelp[draft.category]}
              </p>
            </div>
            <Input
              ref={questionRef}
              label="Question"
              required
              minLength={3}
              maxLength={240}
              value={draft.question}
              disabled={busy}
              onChange={(event) => setDraft((current) => ({ ...current, question: event.target.value }))}
              placeholder="Why do I need to log my weight every week?"
            />
            <div>
              <label htmlFor="nara-answer-variants" className="mb-2 block text-sm font-semibold">
                Alternative questions <span className="font-normal text-brand-muted">(optional)</span>
              </label>
              <textarea
                id="nara-answer-variants"
                rows={3}
                className={fieldStyle}
                value={variants}
                disabled={busy}
                onChange={(event) => setVariants(event.target.value)}
                aria-describedby="nara-variants-help"
              />
              <p id="nara-variants-help" className="mt-2 text-xs text-brand-muted">
                Up to five alternatives, one per line. Add Tagalog or Bisaya versions here. Capitalization and
                punctuation do not need separate entries.
              </p>
            </div>
            <div>
              <label htmlFor="nara-answer-text" className="mb-2 block text-sm font-semibold">
                Instant answer
              </label>
              <textarea
                id="nara-answer-text"
                required
                rows={7}
                maxLength={2500}
                className={fieldStyle}
                value={draft.answer}
                disabled={busy}
                onChange={(event) => setDraft((current) => ({ ...current, answer: event.target.value }))}
                aria-describedby="nara-answer-help"
              />
              <p id="nara-answer-help" className="mt-2 text-xs text-brand-muted">
                Plain text · {draft.answer.length}/2,500 characters. Keep answers factual and current. Personal meal
                clearance and account-status checks retain their existing routes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={busy || !loaded || !dirty}>
                {busy ? 'Saving…' : 'Save draft'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={busy || !selected || dirty || !selected.draft}
                onClick={() => void mutate('publish')}
              >
                Publish answer
              </Button>
              {selected?.published && (
                <Button type="button" variant="secondary" disabled={busy} onClick={() => void mutate('unpublish')}>
                  Unpublish
                </Button>
              )}
              {selected && (
                <Button type="button" variant="ghost" disabled={busy} onClick={() => void mutate('delete')}>
                  Delete answer
                </Button>
              )}
            </div>
            <p className="text-xs text-brand-muted">
              Save changes before publishing. Published text stays active while you edit its draft. The /ai command
              continues to request an AI reply.
            </p>
          </form>
          <div className="mt-7 border-t border-brand-border pt-5">
            <h3 className="font-semibold">Try the wording</h3>
            <p className="mt-1 text-sm text-brand-muted">
              Preview this draft’s exact match. This does not publish or use AI.
            </p>
            <div className="mt-3 flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <Input
                  label="Test question"
                  value={testQuestion}
                  maxLength={1000}
                  onChange={(event) => {
                    setTestQuestion(event.target.value);
                    setPreview(null);
                  }}
                />
              </div>
              <Button variant="secondary" disabled={!testQuestion.trim()} onClick={testDraft}>
                Preview answer
              </Button>
            </div>
            {preview && (
              <div
                role="status"
                className="mt-4 whitespace-pre-wrap break-words rounded-xl bg-brand-bgAlt p-4 text-sm leading-relaxed text-brand-text"
              >
                {preview}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

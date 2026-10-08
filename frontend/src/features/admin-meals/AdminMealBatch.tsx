'use client';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import Button from '@/components/ui/Button';
import api from '@/lib/axios';
type Preview = {
  previewId: string | null;
  valid: boolean;
  alreadyImported: boolean;
  results: { index: number; mealName: string | null; errors: string[] }[];
};
function download(value: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
export default function AdminMealBatch({ active }: { active: boolean }) {
  const ownerId = useAuth().user?.userId;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const library = useSessionQuery<{ meals: { id: string; mealName: string }[]; total: number }>({
    ownerId,
    enabled: active,
    resource: `admin-batch-library:${page}`,
    fetcher: async () => (await api.get('/admin/library', { params: { page, limit: 20 } })).data.data,
    errorMessage: 'Meal selection could not be loaded.',
  });
  async function run(action: 'template' | 'export' | 'preview' | 'import') {
    if (busy) return;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      if (action === 'template')
        download((await api.get('/admin/meals/batch/template')).data.data, 'kainara-meal-template.json');
      if (action === 'export')
        download(
          (await api.post('/admin/meals/batch/export', { ids: selected })).data.data,
          'kainara-selected-meals.json'
        );
      if (action === 'preview') {
        if (new Blob([text]).size > 2 * 1024 * 1024) throw new Error('JSON batches are limited to 2 MB.');
        const result = (await api.post('/admin/meals/batch/preview', JSON.parse(text))).data.data as Preview;
        setPreview(result);
      }
      if (action === 'import' && preview?.previewId) {
        const result = (await api.post('/admin/meals/batch/import', { previewId: preview.previewId })).data.data;
        setMessage(
          result.replayed
            ? 'This batch was already imported. No duplicate drafts were created.'
            : `${result.meals.length} unverified drafts imported. RND review is required before member use.`
        );
        setPreview({ ...preview, alreadyImported: true });
        await library.refetch();
      }
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: string } }; message?: string }).response?.data?.error ??
          (err instanceof SyntaxError
            ? 'The file is not valid JSON.'
            : 'Batch operation failed. No partial import was committed.')
      );
    } finally {
      setBusy(false);
    }
  }
  if (!active) return null;
  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-display text-2xl font-bold">Batch meal drafts</h2>
        <p className="mt-2 text-sm text-brand-muted">
          Import up to 100 meals in a 2 MB JSON file. Every ingredient needs an FNRI mapping and edible grams per
          serving. Imports create new unverified drafts. Published meals and reviews cannot be overwritten.
        </p>
      </header>
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
      <div className="flex flex-wrap gap-3">
        <Button variant="secondary" disabled={busy} onClick={() => void run('template')}>
          Download JSON template
        </Button>
        <Button variant="secondary" disabled={busy || !selected.length} onClick={() => void run('export')}>
          Export {selected.length || ''} selected meals
        </Button>
      </div>
      <details className="rounded-2xl border border-brand-border bg-brand-surface p-4">
        <summary className="min-h-11 cursor-pointer font-semibold">Select library meals for export</summary>
        <p className="mb-3 text-xs text-brand-muted">
          Exports contain recipe fields only. Missing mappings or quantities remain blank and must be corrected before
          importing. Approval identities, flags and member information are excluded.
        </p>
        {library.error && <p role="alert">{library.error}</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {library.data?.meals.map((meal) => (
            <li key={meal.id}>
              <label className="flex min-h-11 items-center gap-3 rounded-xl border border-brand-border px-3 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(meal.id)}
                  disabled={!selected.includes(meal.id) && selected.length >= 100}
                  onChange={(event) =>
                    setSelected(event.target.checked ? [...selected, meal.id] : selected.filter((id) => id !== meal.id))
                  }
                />
                {meal.mealName}
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-xs">Page {page}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={!library.data || page * 20 >= library.data.total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      </details>
      <section className="space-y-4 rounded-2xl border border-brand-border bg-brand-surface p-5">
        <label className="block text-sm font-semibold">
          Upload meal JSON
          <input
            type="file"
            accept=".json,application/json"
            className="mt-2 block min-h-11 w-full text-sm"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              setPreview(null);
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) {
                setError('JSON batches are limited to 2 MB.');
                return;
              }
              setText(await file.text());
              setError(null);
            }}
          />
        </label>
        <label className="block text-sm font-semibold">
          Recipe JSON
          <textarea
            rows={10}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              setPreview(null);
            }}
            className="mt-2 w-full rounded-xl border border-brand-border bg-brand-bg p-3 font-mono text-xs"
          />
        </label>
        <Button variant="secondary" disabled={busy || !text.trim()} onClick={() => void run('preview')}>
          Preview and validate
        </Button>
        {preview && (
          <div className="space-y-3">
            <h3 className="font-semibold">
              {preview.alreadyImported
                ? 'Previously imported batch'
                : preview.valid
                  ? 'Ready to import as unverified drafts'
                  : 'Correct these errors before importing'}
            </h3>
            <ol className="space-y-2">
              {preview.results.map((row) => (
                <li key={row.index} className="rounded-xl border border-brand-border p-3 text-sm">
                  <strong>
                    Meal {row.index + 1}: {row.mealName || 'Name missing'}
                  </strong>
                  {row.errors.length ? (
                    <ul className="mt-2 space-y-1 text-status-error-text">
                      {row.errors.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-brand-green">Draft fields and ingredient mappings passed.</p>
                  )}
                </li>
              ))}
            </ol>
            <Button
              disabled={busy || !preview.valid || !preview.previewId || preview.alreadyImported}
              onClick={() => void run('import')}
            >
              Import all as drafts
            </Button>
            <p className="text-xs text-brand-muted">
              Import rechecks the current catalogue and recipe duplicates. Any failure cancels the whole batch.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

'use client';
import { useRef } from 'react';
import { FileText, ImageIcon } from '@/components/ui/icons';
import Button from '@/components/ui/Button';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import { formatMealTitle } from '@/lib/meal-title';
import { useAdminMealBatch } from './useAdminMealBatch';
import MealJsonEditor from './MealJsonEditor';
import BatchMealPreview from './BatchMealPreview';

export default function AdminMealBatch({ active }: { active: boolean }) {
  const model = useAdminMealBatch(active);
  const file = useRef<HTMLInputElement>(null);
  const { preview, busy, text, run, library } = model;
  if (!active) return null;
  return (
    <div className="min-w-0 space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-bold">Batch meal drafts</h2>
          <p className="mt-1 text-sm leading-relaxed text-brand-muted">
            Write once, add multiple recipes. Each ingredient needs an FNRI ID and edible grams per serving. Import up
            to 100 meals in a 2 MB file.
          </p>
        </div>
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void run('template')}>
          Download JSON template
        </Button>
      </header>
      {model.error && <FeedbackNotice variant="inline">{model.error}</FeedbackNotice>}
      {model.message && <FeedbackNotice tone="success">{model.message}</FeedbackNotice>}
      <section
        aria-label="Batch JSON workspace"
        className="min-w-0 overflow-hidden rounded-2xl border border-brand-border bg-brand-surface"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-border bg-brand-bgAlt/60 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2 font-mono text-xs">
            <FileText className="h-4 w-4 shrink-0 text-brand-green" aria-hidden="true" />
            <span className="truncate">{model.fileName}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={file}
              type="file"
              accept=".json,application/json"
              aria-label="Upload meal JSON"
              className="sr-only"
              disabled={busy}
              onChange={(event) => {
                void model.upload(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => file.current?.click()}>
              Upload JSON
            </Button>
            {!text.trim() && (
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run('insert-template')}>
                Insert template
              </Button>
            )}
            <Button variant="secondary" size="sm" disabled={busy || !text.trim()} onClick={model.format}>
              Format JSON
            </Button>
          </div>
        </div>
        <div className="grid min-w-0 xl:grid-cols-[minmax(0,1fr)_320px]">
          <MealJsonEditor value={text} onChange={model.edit} disabled={busy} />
          <BatchMealPreview text={text} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-border px-4 py-4">
          <p className="max-w-lg text-xs leading-relaxed text-brand-muted">
            Imports create unverified drafts. Published recipes and reviews stay protected.
          </p>
          <Button
            variant="secondary"
            disabled={busy || !text.trim()}
            isLoading={busy}
            onClick={() => void run('preview')}
          >
            Preview and validate
          </Button>
        </div>
      </section>
      {preview && (
        <section aria-label="Batch validation results" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold">
              {preview.alreadyImported
                ? 'Previously imported batch'
                : preview.valid
                  ? 'Ready to import as unverified drafts'
                  : 'Correct these errors before importing'}
            </h3>
            <Button
              disabled={busy || !preview.valid || !preview.previewId || preview.alreadyImported}
              onClick={() => void run('import')}
            >
              Import all as drafts
            </Button>
          </div>
          <WorkspaceTable
            label="Batch import preview"
            rows={preview.results}
            rowKey={(row) => String(row.index)}
            columns={[
              {
                key: 'meal',
                header: 'Meal',
                cell: (row) => (
                  <strong>
                    Meal {row.index + 1}: {formatMealTitle(row.mealName || 'Name missing')}
                  </strong>
                ),
              },
              {
                key: 'validation',
                header: 'Validation',
                headerClassName: 'min-w-[240px]',
                cell: (row) =>
                  row.errors.length ? (
                    <ul className="space-y-1 text-status-error-text">
                      {row.errors.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-brand-green">Draft fields and ingredient mappings passed.</p>
                  ),
              },
            ]}
          />
          <p className="text-xs text-brand-muted">
            Import rechecks the catalogue and duplicate recipes. Any failure cancels the entire batch.
          </p>
        </section>
      )}
      <details className="border-b border-brand-border pb-4">
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold">
          <ImageIcon className="h-4 w-4" aria-hidden="true" />
          Image URLs and JSON fields
        </summary>
        <div className="max-w-3xl space-y-3 pt-2 text-sm leading-relaxed text-brand-muted">
          <p>
            Each meal can include an optional <code>image</code> object. Use a direct HTTPS image from Cloudinary,
            Panlasang Pinoy uploads or a YouTube thumbnail. The app retains the link; importing does not upload the
            photo to Cloudinary.
          </p>
          <p>
            Include <code>url</code>, <code>altText</code>, <code>imageKind</code> (EXACT or REPRESENTATIVE) and{' '}
            <code>licenseCode</code>. Source photos need <code>creator</code> and <code>sourcePageUrl</code>. Use{' '}
            <code>null</code> when the license is unknown; Creative Commons/public-domain declarations also need their
            license URL.
          </p>
          <p>
            Ingredient IDs come from the FNRI catalogue. Export an existing mapped recipe to reuse its IDs. Nutrient
            values and ingredient grams describe one serving.
          </p>
        </div>
      </details>
      <details className="border-b border-brand-border pb-4">
        <summary className="min-h-11 cursor-pointer text-sm font-semibold">Select library meals for export</summary>
        <div className="space-y-3 pt-3">
          <p className="max-w-3xl text-xs leading-relaxed text-brand-muted">
            Exports include recipe fields and supported image links, without approvals or member information. Correct
            missing FNRI mappings before importing.
          </p>
          {library.error && <FeedbackNotice variant="inline">{library.error}</FeedbackNotice>}
          <WorkspaceTable
            label="Meals for batch export"
            rows={library.data?.meals ?? []}
            rowKey={(meal) => meal.id}
            emptyMessage="No library meals found."
            columns={[
              {
                key: 'select',
                header: 'Select',
                headerClassName: 'w-12 text-center',
                cellClassName: 'text-center',
                cell: (meal) => (
                  <input
                    type="checkbox"
                    aria-label={formatMealTitle(meal.mealName)}
                    checked={model.selected.includes(meal.id)}
                    disabled={!model.selected.includes(meal.id) && model.selected.length >= 100}
                    onChange={(event) =>
                      model.setSelected(
                        event.target.checked
                          ? [...model.selected, meal.id]
                          : model.selected.filter((id) => id !== meal.id)
                      )
                    }
                  />
                ),
              },
              { key: 'name', header: 'Meal', cell: (meal) => formatMealTitle(meal.mealName) },
            ]}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="secondary"
              size="sm"
              disabled={busy || !model.selected.length}
              onClick={() => void run('export')}
            >
              Export {model.selected.length || ''} selected meals
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={model.page <= 1}
                onClick={() => model.setPage(model.page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-brand-muted">Page {model.page}</span>
              <Button
                variant="ghost"
                size="sm"
                disabled={!library.data || model.page * 20 >= library.data.total}
                onClick={() => model.setPage(model.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}

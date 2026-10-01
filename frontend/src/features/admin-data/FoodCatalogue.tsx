'use client';

import { useState, type FormEvent } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSessionQuery } from '@/hooks/useSessionQuery';
import { Search, Tags } from 'lucide-react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import CompositionEditor from './CompositionEditor';
import Input from '@/components/ui/Input';
import type { ApiEnvelope, FoodItem, FoodPage, FoodSource } from './types';
import { getApiError } from './types';

interface FoodCatalogueProps {
  source: FoodSource;
  onChanged: (message: string) => Promise<void>;
  onError: (message: string) => void;
}

export default function FoodCatalogue({ source, onChanged, onError }: FoodCatalogueProps) {
  const ownerId = useAuth().user?.userId;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState({ search: '', page: 1 });
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [compositionFood, setCompositionFood] = useState<string | null>(null);
  const label = source === 'FNRI' ? 'FNRI' : 'USDA';
  const query = useSessionQuery<FoodPage>({
    ownerId,
    resource: JSON.stringify(['admin-food-catalogue', source, filter]),
    fetcher: async () => {
      const response = await api.get<ApiEnvelope<FoodPage>>('/admin/data/foods', {
        params: { source, page: filter.page, limit: 12, search: filter.search || undefined },
      });
      return response.data.data;
    },
    errorMessage: `Could not load the ${label} catalogue.`,
  });
  const result = query.data;
  const loading = query.isLoading;

  async function findFoods(event?: FormEvent, page = 1) {
    event?.preventDefault();
    const next = { search: event ? search.trim() : filter.search, page };
    if (next.search === filter.search && next.page === filter.page) await query.refetch();
    else setFilter(next);
  }

  async function addAlias(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    try {
      await api.post('/admin/data/food-aliases', { foodItemId: selected.id, alias: form.get('alias') });
      formElement.reset();
      setSelected(null);
      await query.refetch();
      await onChanged('Verified alias saved. New imports and food lookup can use it.');
    } catch (error) {
      onError(getApiError(error, 'Could not save the alias.'));
    }
  }

  return (
    <section>
      {compositionFood && (
        <CompositionEditor
          key={compositionFood}
          foodId={compositionFood}
          onClose={() => setCompositionFood(null)}
          onChanged={async () => {
            await query.refetch();
            await onChanged('Composition correction published; affected meals require review.');
          }}
        />
      )}
      <Card
        header={
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5 text-brand-green" />
            <div>
              <h2 className="font-display text-lg font-black">{label} catalogue and aliases</h2>
              <p className="text-xs text-brand-muted">
                {source === 'USDA_FDC'
                  ? 'Imported FoodData Central snapshot. Nutrient values are read-only; admins may add audited aliases.'
                  : 'Philippine food-composition records. Admins may review composition and add audited aliases.'}
              </p>
            </div>
          </div>
        }
      >
        <form className="flex gap-2" onSubmit={findFoods}>
          <Input
            label={`Search ${label} catalogue`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search canonical names or aliases"
          />
          <Button type="submit" variant="secondary" isLoading={loading}>
            <Search className="h-4 w-4" /> Search
          </Button>
        </form>
        <p aria-live="polite" className="mt-3 font-mono text-[10px] uppercase tracking-wider text-brand-muted">
          {loading ? 'Loading records…' : result ? `${result.total.toLocaleString()} matching records` : ''}
        </p>
        {query.error && (
          <p role="alert" className="mt-3 text-sm text-status-error-text">
            {query.error}
          </p>
        )}
        {result?.total === 0 && <p className="mt-3 text-sm text-brand-muted">No {label} records match this search.</p>}
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {result?.foods.map((food) => (
            <div key={food.id} className="rounded-[22px] border border-brand-border/55 bg-brand-bgAlt/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-bold text-brand-text">{food.name}</p>
                  <p className="mt-1 text-[11px] text-brand-muted">
                    {food.source === 'USDA_FDC' ? 'USDA FoodData Central' : food.source}
                    {food.sourceRecordId ? ` · ID ${food.sourceRecordId}` : ''}
                    {food.sourceDataset ? ` · ${food.sourceDataset}` : ''}
                  </p>
                  <p className="mt-1 text-[11px] text-brand-muted">
                    {food.calories} kcal · P {food.proteinG} g · C {food.carbsG} g · F {food.fatG} g per 100 g
                  </p>
                  {food.sourceReferenceUrl && (
                    <a
                      href={food.sourceReferenceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-brand-green hover:underline"
                    >
                      View source record
                    </a>
                  )}
                </div>
                {food.source !== 'USDA_FDC' && (
                  <Button size="sm" variant="ghost" onClick={() => setCompositionFood(food.id)}>
                    Composition
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setSelected(food)}>
                  Add alias
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {food.aliases.map((alias) => (
                  <span
                    key={alias.id}
                    title={
                      alias.verifiedByAdmin
                        ? `Verified by ${alias.verifiedByAdmin.name}`
                        : alias.verifiedAt
                          ? 'Curated food alias'
                          : 'Legacy alias'
                    }
                    className={`rounded-full border px-2.5 py-1 text-[10px] ${alias.verifiedAt ? 'border-brand-green/25 bg-brand-green/10 text-brand-green' : 'border-brand-border text-brand-muted'}`}
                  >
                    {alias.alias}
                    {alias.verifiedAt ? ' ✓' : ''}
                  </span>
                ))}
                {food.aliases.length === 0 && <span className="text-[11px] text-brand-muted">No aliases</span>}
              </div>
            </div>
          ))}
        </div>
        {result && result.totalPages > 1 && (
          <nav aria-label="Food catalogue pages" className="mt-5 flex items-center justify-between gap-3">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading || result.page <= 1}
              onClick={() => void findFoods(undefined, result.page - 1)}
            >
              Previous
            </Button>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-muted">
              Page {result.page} of {result.totalPages}
            </span>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading || result.page >= result.totalPages}
              onClick={() => void findFoods(undefined, result.page + 1)}
            >
              Next
            </Button>
          </nav>
        )}
        {selected && (
          <form
            role="region"
            aria-labelledby="verified-alias-heading"
            onSubmit={addAlias}
            className="mt-5 rounded-[24px] border border-brand-green/20 bg-brand-green/5 p-5"
          >
            <p id="verified-alias-heading" className="font-bold text-brand-text">
              Add a verified alias for {selected.name}
            </p>
            <p className="mt-1 text-xs text-brand-muted">
              Aliases affect food matching, so collisions with another composition record are rejected and every change
              is audited.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input
                name="alias"
                label="Verified alias"
                placeholder="Example: boiled egg"
                minLength={2}
                required
                autoFocus
              />
              <Button type="submit">Verify alias</Button>
              <Button type="button" variant="ghost" onClick={() => setSelected(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>
    </section>
  );
}

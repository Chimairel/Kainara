'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { PublicMealImage } from '@/types';
import RecipeLibraryCard from './RecipeLibraryCard';

type Recipe = {
  id: string; name: string; description: string | null; mealTypes: string[];
  calories: number | null; proteinG: number | null; carbsG: number | null; fatG: number | null;
  sourceName: string; sourceUrl: string | null; imageUrl: string | null; planningReady: boolean;
};
type Page = { items: Recipe[]; total: number; page: number; pageCount: number; restrictedProfile: boolean };

export default function VerifiedRecipeCatalog({ search, mealType }: { search: string; mealType: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { setPage(1); }, [search, mealType]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      void api.get('/user/meals/verified-recipes', { params: {
        page, ...(search.trim() ? { search: search.trim() } : {}),
        ...(mealType !== 'All' ? { mealType } : {}),
      } }).then((response) => {
        if (active) { setData(response.data.data); setError(null); }
      }).catch((cause) => {
        if (active) setError(getApiErrorMessage(cause, 'Could not load published recipes.'));
      }).finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [search, mealType, page]);

  if (data?.restrictedProfile && !loading && !error) return (
    <section aria-label="Verified base recipes" className="rounded-xl border border-brand-border p-4">
      <p className="text-xs text-brand-muted">General base recipes are shown here only for profiles without declared conditions, allergies, or restrictions. Your reusable case approvals appear below.</p>
    </section>
  );

  return (
    <section className="space-y-4" aria-label="Verified base recipes">
      {error && <p role="alert" className="rounded-xl border border-red-500/30 p-3 text-xs text-red-400">{error}</p>}
      {loading && <p className="text-xs text-brand-muted">Loading verified recipes…</p>}
      {!loading && data && (
        <>
          {data.items.length === 0 && <p className="rounded-xl border border-brand-border p-4 text-xs text-brand-muted">No verified recipes match this search.</p>}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {data.items.map((recipe) => {
              const image: PublicMealImage | null = recipe.imageUrl && recipe.imageUrl.startsWith('https://panlasangpinoy.com/wp-content/uploads/')
                ? { url: recipe.imageUrl, altText: recipe.name, kind: 'EXACT', attribution: { sourcePageUrl: recipe.sourceUrl } }
                : null;
              return (
                <RecipeLibraryCard
                  key={recipe.id} variant="catalogue" name={recipe.name}
                  mealType={recipe.mealTypes[0] ?? 'LUNCH'} mealTypes={recipe.mealTypes}
                  image={image} description={recipe.description}
                  calories={recipe.planningReady ? recipe.calories : null}
                  proteinG={recipe.proteinG} carbsG={recipe.carbsG} fatG={recipe.fatG}
                  badges={<>
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">Recipe verified</span>
                    <span className="rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs backdrop-blur-md">{recipe.planningReady ? 'Serving data recorded' : 'Serving evidence pending'}</span>
                  </>}
                  footer={recipe.sourceUrl?.startsWith('https://') ? (
                    <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-green hover:underline">View source recipe ↗</a>
                  ) : undefined}
                />
              );
            })}
          </div>
          {data.pageCount > 1 && (
            <nav aria-label="Recipe pages" className="mt-4 flex items-center justify-center gap-4 text-xs font-semibold">
              <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-brand-text transition hover:border-brand-green disabled:opacity-40">Previous</button>
              <span className="text-brand-muted">Page {data.page} of {data.pageCount}</span>
              <button type="button" disabled={page >= data.pageCount} onClick={() => setPage(page + 1)} className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-brand-text transition hover:border-brand-green disabled:opacity-40">Next</button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import MealImage from '@/components/user/MealImage';
import type { PublicMealImage } from '@/types';

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

  if (data?.restrictedProfile && !loading && !error) return <section aria-label="Verified base recipes" className="rounded-xl border border-brand-border p-4">
    <h2 className="text-sm font-bold text-brand-text">Verified recipe catalogue</h2>
    <p className="mt-1 text-xs text-brand-muted">General base recipes are shown here only for profiles without declared conditions, allergies, or restrictions. Your reusable case approvals appear below.</p>
  </section>;
  return <section className="space-y-3" aria-label="Verified base recipes">
    <div>
      <h2 className="text-sm font-bold text-brand-text">Verified recipe catalogue{data ? ` · ${data.total}` : ''}</h2>
      <p className="text-xs text-brand-muted">Published Panlasang Pinoy dishes and individually verified new recipes. A verified recipe is a real dish; it still needs complete serving data and a fit for your plan before KAINARA can schedule it. These cards are for browsing.</p>
    </div>
    {error && <p role="alert" className="rounded-xl border border-red-500/30 p-3 text-xs text-red-400">{error}</p>}
    {loading && <p className="text-xs text-brand-muted">Loading verified recipes…</p>}
    {!loading && data && <>
      {data.items.length === 0 && <p className="rounded-xl border border-brand-border p-4 text-xs text-brand-muted">No verified recipes match this search.</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.items.map((recipe) => {
          const image: PublicMealImage | null = recipe.imageUrl && recipe.imageUrl.startsWith('https://panlasangpinoy.com/wp-content/uploads/')
            ? { url: recipe.imageUrl, altText: recipe.name, kind: 'EXACT', attribution: { sourcePageUrl: recipe.sourceUrl } }
            : null;
          return <article key={recipe.id} className="space-y-3 rounded-[22px] border border-brand-border bg-brand-surface p-5">
            <MealImage image={image} mealName={recipe.name} mealType={recipe.mealTypes[0] ?? 'LUNCH'} className="h-36 w-full" showAttributionLinks />
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className="rounded-full border border-brand-green/40 px-2 py-1 text-brand-green">Recipe verified</span>
              <span className="rounded-full border border-brand-border px-2 py-1 text-brand-muted">{recipe.planningReady ? 'Serving data recorded' : 'Serving evidence pending'}</span>
            </div>
            <p className="text-[11px] font-bold text-brand-green">{recipe.mealTypes.join(' · ') || 'MEAL'}</p>
            <h3 className="text-sm font-bold text-brand-text">{recipe.name}</h3>
            {recipe.description && <p className="line-clamp-3 text-xs text-brand-muted">{recipe.description}</p>}
            {recipe.planningReady && <p className="text-xs text-brand-muted">Recorded serving: {recipe.calories} kcal · P {recipe.proteinG} g · C {recipe.carbsG} g · F {recipe.fatG} g</p>}
            {recipe.sourceUrl?.startsWith('https://') && <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-semibold text-brand-green underline">View source recipe ↗</a>}
          </article>;
        })}
      </div>
      {data.pageCount > 1 && <nav aria-label="Recipe pages" className="flex items-center justify-center gap-4 text-xs">
        <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-brand-border px-3 py-2 disabled:opacity-40">Previous</button>
        <span>Page {data.page} of {data.pageCount}</span>
        <button type="button" disabled={page >= data.pageCount} onClick={() => setPage(page + 1)} className="rounded-lg border border-brand-border px-3 py-2 disabled:opacity-40">Next</button>
      </nav>}
    </>}
  </section>;
}

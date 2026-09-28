'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import MealImage from '@/components/user/MealImage';
import { getMealBannerTheme } from '@/components/user/MealCard';
import type { PublicMealImage } from '@/types';

type Recipe = {
  id: string;
  name: string;
  description: string | null;
  mealTypes: string[];
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  sourceName: string;
  sourceUrl: string | null;
  imageUrl: string | null;
  planningReady: boolean;
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
      <h2 className="text-sm font-bold text-brand-text">Verified recipe catalogue</h2>
      <p className="mt-1 text-xs text-brand-muted">General base recipes are shown here only for profiles without declared conditions, allergies, or restrictions. Your reusable case approvals appear below.</p>
    </section>
  );

  return (
    <section className="space-y-3" aria-label="Verified base recipes">
      <div>
        <h2 className="text-sm font-bold text-brand-text">Verified recipe catalogue{data ? ` · ${data.total}` : ''}</h2>
        <p className="text-xs text-brand-muted">Published Panlasang Pinoy dishes and individually verified new recipes. A verified recipe is a real dish; it still needs complete serving data and a fit for your plan before KAINARA can schedule it. These cards are for browsing.</p>
      </div>
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
              const primaryType = recipe.mealTypes[0] ?? 'LUNCH';
              const bannerTheme = getMealBannerTheme(primaryType);

              return (
                <article
                  key={recipe.id}
                  className={`group relative flex h-full flex-col justify-between rounded-3xl bg-brand-surface p-2 sm:p-2.5 ${bannerTheme.shadow} ${bannerTheme.hoverShadow} transition-all duration-300 hover:-translate-y-1`}
                >
                  {/* Upper Banner with Cropped Circular Food Plate on Left */}
                  <div className={`relative h-40 sm:h-44 w-full overflow-hidden rounded-2xl ${bannerTheme.bannerBg}`}>
                    {/* Circular Plate on Left - Enlarge and crop so parts cut out */}
                    <div
                      className={`absolute -left-9 sm:-left-12 top-1/2 -translate-y-1/2 h-52 w-52 sm:h-56 sm:w-56 rounded-full ${bannerTheme.plateBorder} bg-white dark:bg-[#071914] shadow-[0_12px_28px_rgba(0,0,0,0.22)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.7)] overflow-hidden transition-transform duration-300 group-hover:scale-105`}
                    >
                      <div className="relative h-full w-full rounded-full overflow-hidden">
                        <MealImage
                          image={image}
                          mealName={recipe.name}
                          mealType={primaryType}
                          className="!rounded-full !border-0 h-full w-full object-cover"
                          variant="thumbnail"
                          hideRepresentativeBadge
                          showAttributionLinks
                        />
                      </div>
                    </div>

                    {/* Top Right Badges */}
                    <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5 z-10 max-w-[55%]">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/95 dark:bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-text shadow-sm backdrop-blur-md">
                        {recipe.mealTypes.join(' · ') || 'MEAL'}
                      </span>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                        Recipe verified
                      </span>
                      <span className="rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs backdrop-blur-md">
                        {recipe.planningReady ? 'Serving data recorded' : 'Serving evidence pending'}
                      </span>
                    </div>
                  </div>

                  {/* Lower Details */}
                  <div className="flex-1 flex flex-col justify-between p-2 pt-2.5">
                    <div>
                      <h3 className="text-base font-bold font-display tracking-tight text-brand-text leading-snug line-clamp-1">
                        {recipe.name}
                      </h3>
                      {recipe.description && (
                        <p className="line-clamp-2 text-xs text-brand-muted mt-0.5">{recipe.description}</p>
                      )}
                    </div>

                    {/* Macro Chips Row - Theme Colors */}
                    {recipe.planningReady && recipe.calories !== null ? (
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-brand-text border border-black/10 dark:border-white/10">
                          <span className="text-[10px]">🔥</span> {Math.round(recipe.calories)} kcal
                        </span>
                        {recipe.proteinG !== null && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#08705b]/10 dark:bg-[#10b981]/15 px-2.5 py-1 text-[11px] font-bold text-[#08705b] dark:text-[#34d399] border border-[#08705b]/20 dark:border-[#10b981]/30">
                            {Math.round(recipe.proteinG)}g P
                          </span>
                        )}
                        {recipe.carbsG !== null && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#18b9d2]/10 dark:bg-[#38bdf8]/15 px-2.5 py-1 text-[11px] font-bold text-[#0b7788] dark:text-[#38bdf8] border border-[#18b9d2]/20 dark:border-[#38bdf8]/30">
                            {Math.round(recipe.carbsG)}g C
                          </span>
                        )}
                        {recipe.fatG !== null && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#eb6a38]/10 dark:bg-[#eb6a38]/15 px-2.5 py-1 text-[11px] font-bold text-[#c74614] dark:text-[#f09e6c] border border-[#eb6a38]/20 dark:border-[#eb6a38]/30">
                            {Math.round(recipe.fatG)}g F
                          </span>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-brand-muted italic">Serving evidence pending clinical portioning</p>
                    )}

                    {recipe.sourceUrl?.startsWith('https://') && (
                      <div className="mt-3 pt-2.5 border-t border-brand-border/40 text-xs">
                        <a
                          href={recipe.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-green hover:underline"
                        >
                          View source recipe ↗
                        </a>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {data.pageCount > 1 && (
            <nav aria-label="Recipe pages" className="flex items-center justify-center gap-4 text-xs mt-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-brand-border px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page {data.page} of {data.pageCount}
              </span>
              <button
                type="button"
                disabled={page >= data.pageCount}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-brand-border px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

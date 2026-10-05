'use client';

import { useAuth } from '@/hooks/useAuth';
import Pagination from '@/components/ui/Pagination';
import MealLibraryLayout from '@/components/shared/MealLibraryLayout';
import { useEffect, useState } from 'react';
import { useRecipeCatalog } from './useRecipeCatalog';
import type { PublicMealImage } from '@/types';
import RecipeLibraryCard from './RecipeLibraryCard';

export default function VerifiedRecipeCatalog({ search, mealType }: { search: string; mealType: string }) {
  const ownerId = useAuth().user?.userId;
  const [page, setPage] = useState(1);
  const { data, error, loading, retry } = useRecipeCatalog({ search, mealType, page, ownerId });
  useEffect(() => {
    setPage(1);
  }, [search, mealType]);
  if (data?.restrictedProfile && !loading && !error)
    return (
      <section aria-label="Verified base recipes" className="rounded-xl border border-brand-border p-4">
        <p className="text-xs text-brand-muted">
          General base recipes are shown here only for profiles without declared conditions, allergies, or restrictions.
          Your reusable case approvals appear below.
        </p>
      </section>
    );

  return (
    <section className="space-y-4" aria-label="Verified base recipes">
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 p-3 text-xs text-red-400">
          {error}
          <button type="button" onClick={retry} className="ml-3 min-h-11 underline">
            Retry
          </button>
        </p>
      )}
      {loading && <p className="text-xs text-brand-muted">Loading verified recipes…</p>}
      {!loading && data && (
        <>
          {data.items.length === 0 && (
            <p className="rounded-xl border border-brand-border p-4 text-xs text-brand-muted">
              No verified recipes match this search.
            </p>
          )}
          <MealLibraryLayout>
            {data.items.map((recipe) => {
              const image: PublicMealImage | null =
                recipe.imageUrl && recipe.imageUrl.startsWith('https://panlasangpinoy.com/wp-content/uploads/')
                  ? {
                      url: recipe.imageUrl,
                      altText: recipe.name,
                      kind: 'EXACT',
                      attribution: { sourcePageUrl: recipe.sourceUrl },
                    }
                  : null;
              return (
                <RecipeLibraryCard
                  key={recipe.id}
                  variant="catalogue"
                  name={recipe.name}
                  mealType={recipe.mealTypes[0] ?? 'LUNCH'}
                  mealTypes={recipe.mealTypes}
                  image={image}
                  description={recipe.description}
                  calories={recipe.planningReady ? recipe.calories : null}
                  proteinG={recipe.proteinG}
                  carbsG={recipe.carbsG}
                  fatG={recipe.fatG}
                  badges={
                    <>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                        Recipe verified
                      </span>
                      <span className="rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs backdrop-blur-md">
                        {recipe.planningReady ? 'Serving data recorded' : 'Serving evidence pending'}
                      </span>
                    </>
                  }
                  footer={
                    recipe.sourceUrl?.startsWith('https://') ? (
                      <a
                        href={recipe.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-brand-green hover:underline"
                      >
                        View source recipe ↗
                      </a>
                    ) : undefined
                  }
                />
              );
            })}
          </MealLibraryLayout>
          {data.pageCount > 1 && (
            <Pagination
              page={data.page}
              pageCount={data.pageCount}
              busy={loading}
              onPageChange={setPage}
              label="Recipe pages"
              showNumbers
            />
          )}
        </>
      )}
    </section>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, Search, Salad } from 'lucide-react';
import type { useMealsWorkspace } from './useMealsWorkspace';
import { groupApprovedPlanRecipes } from './approvedPlanRecipes';
import RecipeLibraryCard from './RecipeLibraryCard';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import type { PublicMealImage } from '@/types';

type CatalogRecipe = {
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
  inPlan?: boolean;
  occurrences?: Array<{ id: string; scheduledDate: string; cycleScope: string | null }>;
  planMealId?: string | null;
};

type CatalogPage = {
  items: CatalogRecipe[];
  total: number;
  page: number;
  pageCount: number;
  restrictedProfile: boolean;
};

export default function MealLibraryPanel({ workspace }: { workspace: ReturnType<typeof useMealsWorkspace> }) {
  const {
    handleLibrarySearchSubmit,
    librarySearch,
    setLibrarySearch,
    libraryMealType,
    setLibraryMealType,
    libraryRiceRole,
    setLibraryRiceRole,
    meals,
    libraryMeals,
  } = workspace;

  const [page, setPage] = useState(1);
  const [catalogData, setCatalogData] = useState<CatalogPage | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const PAGE_SIZE = 6;

  useEffect(() => {
    setPage(1);
  }, [librarySearch, libraryMealType, libraryRiceRole]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setCatalogLoading(true);
      void api
        .get('/user/meals/verified-recipes', {
          params: {
            page,
            ...(librarySearch.trim() ? { search: librarySearch.trim() } : {}),
            ...(libraryMealType !== 'All' ? { mealType: libraryMealType } : {}),
            ...(libraryRiceRole !== 'All' ? { riceRole: libraryRiceRole } : {}),
          },
        })
        .then((response) => {
          if (active) {
            setCatalogData(response.data.data);
            setCatalogError(null);
          }
        })
        .catch((err) => {
          if (active) {
            setCatalogError(getApiErrorMessage(err, 'Could not load recipes.'));
          }
        })
        .finally(() => {
          if (active) setCatalogLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [librarySearch, libraryMealType, libraryRiceRole, page]);

  const search = librarySearch.trim().toLowerCase();
  const plannedLibraryIds = useMemo(
    () => new Set(meals.map((meal) => meal.libraryMealId).filter(Boolean)),
    [meals]
  );

  const approvedInPlan = useMemo(() => {
    return groupApprovedPlanRecipes(
      meals.filter(
        (meal) =>
          meal.status === 'APPROVED' &&
          libraryRiceRole === 'All' &&
          (libraryMealType === 'All' || meal.mealType === libraryMealType) &&
          (!search || meal.mealName.toLowerCase().includes(search))
      )
    );
  }, [meals, libraryRiceRole, libraryMealType, search]);

  const filteredLibraryMeals = useMemo(() => {
    return libraryMeals.filter(
      (meal) =>
        (libraryRiceRole === 'All' || meal.riceRole === libraryRiceRole) &&
        (libraryMealType === 'All' || meal.mealType === libraryMealType || meal.mealTypes?.includes(libraryMealType)) &&
        (!search || meal.mealName.toLowerCase().includes(search))
    );
  }, [libraryMeals, libraryRiceRole, libraryMealType, search]);

  const isServerSource = Boolean(catalogData && !catalogData.restrictedProfile);

  const clientUnifiedItems = useMemo(() => {
    const plannedItems = approvedInPlan.map(({ meal, occurrences }) => ({
      id: meal.id,
      name: meal.mealName,
      mealType: meal.mealType,
      mealTypes: [meal.mealType],
      image: meal.image ?? null,
      description: meal.description,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
      inPlan: true,
      occurrences: occurrences.map((o) => ({
        id: o.id,
        scheduledDate: String(o.scheduledDate),
        cycleScope: o.cycleScope ?? null,
      })),
      sourceUrl: null as string | null,
      reuseBasis: null as string | null,
      planningReady: true,
    }));

    const nonPlannedItems = filteredLibraryMeals
      .filter((lm) => !plannedItems.some((pi) => pi.name.toLowerCase() === lm.mealName.toLowerCase()))
      .map((meal) => ({
        id: meal.id,
        name: meal.mealName,
        mealType: meal.mealType,
        mealTypes: meal.mealTypes?.length ? meal.mealTypes : [meal.mealType],
        image: meal.image ?? null,
        description: meal.description,
        calories: meal.calories,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
        inPlan: plannedLibraryIds.has(meal.id),
        occurrences: [] as Array<{ id: string; scheduledDate: string; cycleScope: string | null }>,
        sourceUrl: null as string | null,
        reuseBasis: meal.reuseBasis ?? null,
        planningReady: true,
      }));

    const merged = [...plannedItems, ...nonPlannedItems];
    merged.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    return merged;
  }, [approvedInPlan, filteredLibraryMeals, plannedLibraryIds]);

  const totalPages = isServerSource && catalogData
    ? Math.max(1, catalogData.pageCount)
    : Math.max(1, Math.ceil(clientUnifiedItems.length / PAGE_SIZE));

  const displayItems = useMemo(() => {
    if (isServerSource && catalogData) {
      return catalogData.items.map((recipe) => {
        const matchingPlan = approvedInPlan.find(
          (p) =>
            p.meal.mealName.toLowerCase() === recipe.name.toLowerCase() ||
            (p.meal.libraryMealId && p.meal.libraryMealId === recipe.id)
        );
        const inPlan = Boolean(recipe.inPlan || matchingPlan);
        const occurrences = matchingPlan
          ? matchingPlan.occurrences.map((o) => ({
              id: o.id,
              scheduledDate: String(o.scheduledDate),
              cycleScope: o.cycleScope ?? null,
            }))
          : recipe.occurrences ?? [];

        const image: PublicMealImage | null =
          matchingPlan?.meal.image ??
          (recipe.imageUrl && recipe.imageUrl.startsWith('https://panlasangpinoy.com/wp-content/uploads/')
            ? {
                url: recipe.imageUrl,
                altText: recipe.name,
                kind: 'EXACT',
                attribution: { sourcePageUrl: recipe.sourceUrl },
              }
            : null);

        return {
          id: recipe.id,
          name: recipe.name,
          mealType: matchingPlan?.meal.mealType ?? recipe.mealTypes[0] ?? 'LUNCH',
          mealTypes: recipe.mealTypes,
          image,
          description: recipe.description,
          calories: inPlan || recipe.planningReady ? (matchingPlan?.meal.calories ?? recipe.calories) : null,
          proteinG: matchingPlan?.meal.proteinG ?? recipe.proteinG,
          carbsG: matchingPlan?.meal.carbsG ?? recipe.carbsG,
          fatG: matchingPlan?.meal.fatG ?? recipe.fatG,
          inPlan,
          occurrences,
          sourceUrl: recipe.sourceUrl,
          reuseBasis: null,
          planningReady: recipe.planningReady,
        };
      });
    }

    return clientUnifiedItems.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  }, [isServerSource, catalogData, approvedInPlan, clientUnifiedItems, page]);

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col items-stretch gap-3 rounded-[22px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-sm md:flex-row md:items-center md:justify-between">
        <form onSubmit={handleLibrarySearchSubmit} className="flex w-full gap-2 md:max-w-xs lg:max-w-sm">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search verified recipes</span>
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="h-10 w-full rounded-xl border border-brand-border bg-brand-bgAlt/60 pl-10 pr-3 text-xs text-brand-text outline-none focus:border-brand-green"
            />
          </label>
          <Button type="submit" variant="secondary" className="h-10 px-4 text-xs">
            Apply
          </Button>
        </form>

        <div className="relative flex items-center shrink-0">
          <label htmlFor="library-rice-role-select" className="sr-only">
            Rice role
          </label>
          <select
            id="library-rice-role-select"
            value={libraryRiceRole}
            onChange={(event) => setLibraryRiceRole(event.target.value)}
            aria-label="Rice role"
            className="h-10 appearance-none rounded-xl border border-brand-border bg-brand-bgAlt/60 pl-3.5 pr-8 text-xs font-bold text-brand-text transition-all outline-none hover:border-brand-green/50 focus:border-brand-green focus:bg-brand-surface dark:bg-[#0e271f] dark:border-[#173e33] dark:text-white cursor-pointer"
          >
            <option value="All">All reviewed roles</option>
            <option value="PAIR_WITH_RICE">Pair with rice</option>
            <option value="STANDALONE">Standalone</option>
            <option value="INCLUDES_RICE">Includes rice</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-brand-muted" />
        </div>

        <div className="flex w-full gap-1 overflow-x-auto rounded-xl bg-brand-bgAlt/60 p-1 select-none md:w-auto">
          {['All', 'BREAKFAST', 'LUNCH', 'DINNER'].map((type) => (
            <button
              key={type}
              onClick={() => setLibraryMealType(type)}
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
                libraryMealType === type
                  ? 'border-brand-green bg-brand-green text-white dark:border-brand-accent dark:bg-brand-accent dark:text-black shadow-sm'
                  : 'border-transparent text-brand-muted hover:bg-brand-surface hover:text-brand-text'
              }`}
            >
              {type === 'All' ? 'All Types' : type.charAt(0) + type.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      {catalogError && (
        <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
          <span>{catalogError}</span>
        </div>
      )}

      {catalogLoading && displayItems.length === 0 ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <LoadingSpinner size="md" />
          <span className="text-xs text-brand-muted">Loading recipes…</span>
        </div>
      ) : displayItems.length === 0 ? (
        <div className="p-12 text-center border border-brand-border/40 bg-brand-surface/30 rounded-xl">
          <Salad className="w-8 h-8 text-brand-green mx-auto mb-2" />
          <p className="text-sm text-brand-text font-semibold">No recipes match this selection</p>
          <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
            Try adjusting your search query or filters.
          </p>
        </div>
      ) : (
        <section aria-label="Meal library recipes" className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {displayItems.map((item) => (
              <RecipeLibraryCard
                key={item.id}
                variant={item.inPlan ? 'planned' : item.reuseBasis ? 'reusable' : 'catalogue'}
                name={item.name}
                mealType={item.mealType}
                mealTypes={item.mealTypes}
                image={item.image}
                description={item.description}
                calories={item.calories}
                proteinG={item.proteinG}
                carbsG={item.carbsG}
                fatG={item.fatG}
                badges={
                  item.inPlan ? (
                    <>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                        Scheduled for you
                      </span>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                        In your plan{item.occurrences.length > 1 ? ` · ${item.occurrences.length} times` : ''}
                      </span>
                    </>
                  ) : item.reuseBasis === 'PROFILE_MATCHED_APPROVAL' ? (
                    <span className="rounded-full border border-emerald-400/40 bg-black/40 px-2 py-0.5 text-[10px] font-bold text-emerald-200 backdrop-blur-md">
                      Reviewed for a matching health profile
                    </span>
                  ) : (
                    <>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                        Recipe verified
                      </span>
                      <span className="rounded-full border border-white/30 bg-black/40 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs backdrop-blur-md">
                        {item.planningReady ? 'Serving data recorded' : 'Serving evidence pending'}
                      </span>
                    </>
                  )
                }
                footer={
                  item.inPlan ? (
                    item.occurrences.length === 1 ? (
                      <Link
                        href={`/dashboard/${item.occurrences[0].id}`}
                        className="font-semibold text-brand-green hover:underline"
                      >
                        View planned meal
                      </Link>
                    ) : item.occurrences.length > 1 ? (
                      <div className="flex flex-wrap gap-x-4 gap-y-2 font-semibold text-brand-green">
                        {item.occurrences.map((slot) => (
                          <Link key={slot.id} href={`/dashboard/${slot.id}`} className="hover:underline">
                            {slot.cycleScope === 'UPCOMING' ? 'Next week' : 'This week'} ·{' '}
                            {new Date(slot.scheduledDate).toLocaleDateString('en-PH', {
                              month: 'short',
                              day: 'numeric',
                              timeZone: 'Asia/Manila',
                            })}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <Link
                        href={`/dashboard/${item.id}`}
                        className="font-semibold text-brand-green hover:underline"
                      >
                        View planned meal
                      </Link>
                    )
                  ) : item.sourceUrl?.startsWith('https://') ? (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-brand-green hover:underline"
                    >
                      View source recipe ↗
                    </a>
                  ) : undefined
                }
              />
            ))}
          </div>

          {totalPages > 1 && (
            <nav
              aria-label="Recipe pages"
              className="mt-4 flex items-center justify-center gap-4 text-xs font-semibold"
            >
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-brand-text transition hover:border-brand-green disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-brand-muted">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-brand-text transition hover:border-brand-green disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </section>
      )}
    </div>
  );
}

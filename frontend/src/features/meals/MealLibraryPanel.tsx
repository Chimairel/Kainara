'use client';
import { useEffect, useState } from 'react';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LibraryMealCard from './LibraryMealCard';
import Link from 'next/link';
import { AlertTriangle, ChevronDown, Search, Salad } from 'lucide-react';
import type { useMealsWorkspace } from './useMealsWorkspace';
import { groupApprovedPlanRecipes } from './approvedPlanRecipes';
import VerifiedRecipeCatalog from './VerifiedRecipeCatalog';
import RecipeLibraryCard from './RecipeLibraryCard';

export default function MealLibraryPanel({ workspace }: { workspace: ReturnType<typeof useMealsWorkspace> }) {
  const {
    handleLibrarySearchSubmit,
    librarySearch,
    setLibrarySearch,
    libraryMealType,
    setLibraryMealType,
    isLibraryLoading,
    libraryError,
    libraryMeals,
    setSelectedVerifier,
    libraryRiceRole,
    setLibraryRiceRole,
    libraryNextCursor,
    loadMoreLibrary,
    meals,
  } = workspace;
  const plannedLibraryIds = new Set(meals.map((meal) => meal.libraryMealId).filter(Boolean));
  const search = librarySearch.trim().toLocaleLowerCase();
  const approvedInPlan = groupApprovedPlanRecipes(
    meals.filter(
      (meal) =>
        meal.status === 'APPROVED' &&
        libraryRiceRole === 'All' &&
        (libraryMealType === 'All' || meal.mealType === libraryMealType) &&
        (!search || meal.mealName.toLocaleLowerCase().includes(search)) &&
        (!meal.libraryMealId || !libraryMeals.some((entry) => entry.id === meal.libraryMealId))
    )
  );

  const [planPage, setPlanPage] = useState(1);
  const PLAN_PAGE_SIZE = 6;
  const totalPlanPages = Math.ceil(approvedInPlan.length / PLAN_PAGE_SIZE);
  const pagedApprovedInPlan = approvedInPlan.slice((planPage - 1) * PLAN_PAGE_SIZE, planPage * PLAN_PAGE_SIZE);

  useEffect(() => {
    setPlanPage(1);
  }, [librarySearch, libraryMealType, libraryRiceRole]);

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

      {approvedInPlan.length > 0 && (
        <section className="space-y-4" aria-label="Meals approved for your plan">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pagedApprovedInPlan.map(({ meal, occurrences }) => {
              return (
                <RecipeLibraryCard
                  key={meal.id}
                  variant="planned"
                  name={meal.mealName}
                  mealType={meal.mealType}
                  image={meal.image ?? null}
                  description={meal.description}
                  calories={meal.calories}
                  proteinG={meal.proteinG}
                  carbsG={meal.carbsG}
                  fatG={meal.fatG}
                  badges={
                    <>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                        Scheduled for you
                      </span>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                        In your plan{occurrences.length > 1 ? ` · ${occurrences.length} times` : ''}
                      </span>
                    </>
                  }
                  footer={
                    occurrences.length === 1 ? (
                      <Link href={`/dashboard/${meal.id}`} className="font-semibold text-brand-green hover:underline">
                        View planned meal
                      </Link>
                    ) : (
                      <div className="flex flex-wrap gap-x-4 gap-y-2 font-semibold text-brand-green">
                        {occurrences.map((slot) => (
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
                    )
                  }
                />
              );
            })}
          </div>
          {totalPlanPages > 1 && (
            <nav aria-label="Planned recipe pages" className="mt-4 flex items-center justify-center gap-4 text-xs font-semibold">
              <button
                type="button"
                disabled={planPage <= 1}
                onClick={() => setPlanPage((prev) => Math.max(1, prev - 1))}
                className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-brand-text transition hover:border-brand-green disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-brand-muted">
                Page {planPage} of {totalPlanPages}
              </span>
              <button
                type="button"
                disabled={planPage >= totalPlanPages}
                onClick={() => setPlanPage((prev) => Math.min(totalPlanPages, prev + 1))}
                className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-brand-text transition hover:border-brand-green disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          )}
        </section>
      )}

      <VerifiedRecipeCatalog search={librarySearch} mealType={libraryMealType} />

      {isLibraryLoading ? (
        <div className="flex flex-col items-center py-12 gap-2">
          <LoadingSpinner size="md" />
          <span className="text-xs text-brand-muted">Loading recipes...</span>
        </div>
      ) : libraryError ? (
        <div className="p-4 rounded-xl bg-status-error-bg/10 border border-status-error-text/25 text-status-error-text text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-status-error-text shrink-0" />
          <span>{libraryError}</span>
        </div>
      ) : libraryMeals.length === 0 && approvedInPlan.length === 0 ? (
        <div className="p-12 text-center border border-brand-border/40 bg-brand-surface/30 rounded-xl">
          <Salad className="w-8 h-8 text-brand-green mx-auto mb-2" />
          <p className="text-sm text-brand-text font-semibold">No reusable approvals for this selection</p>
          <p className="text-xs text-brand-muted mt-1 max-w-sm mx-auto">
            The published recipe catalogue above is separate from meals with a complete reusable serving or case
            approval.
          </p>
        </div>
      ) : libraryMeals.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {libraryMeals.map((meal) => (
            <LibraryMealCard
              key={meal.id}
              meal={{ ...meal, alreadyPlannedInCycle: plannedLibraryIds.has(meal.id) }}
              onVerifier={setSelectedVerifier}
            />
          ))}
        </div>
      ) : null}
      {libraryNextCursor && !isLibraryLoading && (
        <div className="flex justify-center">
          <Button type="button" variant="secondary" onClick={loadMoreLibrary}>
            Load more recipes
          </Button>
        </div>
      )}
    </div>
  );
}

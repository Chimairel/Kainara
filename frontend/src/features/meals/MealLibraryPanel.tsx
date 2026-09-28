'use client';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import LibraryMealCard from './LibraryMealCard';
import MealImage from '@/components/user/MealImage';
import Link from 'next/link';
import { AlertTriangle, Heart, Search, Salad } from 'lucide-react';
import type { useMealsWorkspace } from './useMealsWorkspace';
import { groupApprovedPlanRecipes } from './approvedPlanRecipes';
import VerifiedRecipeCatalog from './VerifiedRecipeCatalog';
import { getMealBannerTheme } from '@/components/user/MealCard';

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
    libraryFavoriteOnly,
    setLibraryFavoriteOnly,
    libraryRiceRole,
    setLibraryRiceRole,
    libraryNextCursor,
    loadMoreLibrary,
    toggleLibraryFavorite,
    libraryTotalCount,
    meals,
  } = workspace;
  const plannedLibraryIds = new Set(meals.map((meal) => meal.libraryMealId).filter(Boolean));
  const search = librarySearch.trim().toLocaleLowerCase();
  const approvedInPlan = groupApprovedPlanRecipes(meals.filter((meal) =>
    meal.status === 'APPROVED' &&
    !libraryFavoriteOnly &&
    libraryRiceRole === 'All' &&
    (libraryMealType === 'All' || meal.mealType === libraryMealType) &&
    (!search || meal.mealName.toLocaleLowerCase().includes(search)) &&
    (!meal.libraryMealId || !libraryMeals.some((entry) => entry.id === meal.libraryMealId))
  ));
  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col items-center justify-between gap-3 rounded-[22px] border border-brand-border/70 bg-brand-surface/90 p-3 shadow-sm md:flex-row">
        <form onSubmit={handleLibrarySearchSubmit} className="flex w-full gap-2 md:max-w-sm">
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

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setLibraryFavoriteOnly(!libraryFavoriteOnly)}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 font-bold ${
            libraryFavoriteOnly
              ? 'border-brand-green bg-brand-green text-black'
              : 'border-brand-border text-brand-muted'
          }`}
        >
          <Heart className={`h-4 w-4 ${libraryFavoriteOnly ? 'fill-current' : ''}`} /> Favorites
        </button>
        <label className="flex items-center gap-2 font-semibold text-brand-muted">
          Rice role
          <select
            value={libraryRiceRole}
            onChange={(event) => setLibraryRiceRole(event.target.value)}
            className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-brand-text"
          >
            <option value="All">All reviewed roles</option>
            <option value="PAIR_WITH_RICE">Pair with rice</option>
            <option value="STANDALONE">Standalone</option>
            <option value="INCLUDES_RICE">Includes rice</option>
          </select>
        </label>
        {libraryTotalCount !== null && (
          <span className="ml-auto text-brand-muted">{libraryTotalCount} reusable approvals · {approvedInPlan.length} approved {approvedInPlan.length === 1 ? 'recipe' : 'recipes'} in plan</span>
        )}
      </div>

      {approvedInPlan.length > 0 && (
        <section className="space-y-3" aria-label="Meals approved for your plan">
          <div>
            <h2 className="text-sm font-bold text-brand-text">Meals in your current or upcoming plan</h2>
            <p className="text-xs text-brand-muted">
              These servings were scheduled for your plan. This does not mean each had a separate nutritionist case approval.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {approvedInPlan.map(({ meal, occurrences }) => {
              const bannerTheme = getMealBannerTheme(meal.mealType);
              return (
                <article
                  key={meal.id}
                  className={`group relative flex h-full flex-col justify-between rounded-3xl bg-brand-surface p-2 sm:p-2.5 ${bannerTheme.shadow} ${bannerTheme.hoverShadow} transition-all duration-300 hover:-translate-y-1`}
                >
                  {/* Upper Banner with Cropped Circular Plate on Left */}
                  <div className={`relative h-40 sm:h-44 w-full overflow-hidden rounded-2xl ${bannerTheme.bannerBg}`}>
                    {/* Circular Plate on Left - Enlarge and crop so parts cut out */}
                    <div
                      className={`absolute -left-9 sm:-left-12 top-1/2 -translate-y-1/2 h-52 w-52 sm:h-56 sm:w-56 rounded-full ${bannerTheme.plateBorder} bg-white dark:bg-[#071914] shadow-[0_12px_28px_rgba(0,0,0,0.22)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.7)] overflow-hidden transition-transform duration-300 group-hover:scale-105`}
                    >
                      <div className="relative h-full w-full rounded-full overflow-hidden">
                        <MealImage
                          image={meal.image}
                          mealName={meal.mealName}
                          mealType={meal.mealType}
                          className="!rounded-full !border-0 h-full w-full object-cover"
                          variant="thumbnail"
                          hideRepresentativeBadge
                          showAttributionLinks
                        />
                      </div>
                    </div>

                    {/* Top Right Badges */}
                    <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5 z-10">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/95 dark:bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-text shadow-sm backdrop-blur-md">
                        {meal.mealType}
                      </span>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                        Scheduled for you
                      </span>
                      <span className="rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                        In your plan{occurrences.length > 1 ? ` · ${occurrences.length} times` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Lower Details */}
                  <div className="flex-1 flex flex-col justify-between p-2 pt-2.5">
                    <div>
                      <h3 className="text-base font-bold font-display tracking-tight text-brand-text leading-snug line-clamp-1">
                        {meal.mealName}
                      </h3>
                      {meal.description && (
                        <p className="text-xs text-brand-muted line-clamp-1 mt-0.5">{meal.description}</p>
                      )}
                    </div>

                    {/* Macro Chips Row - Theme Colors */}
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-brand-text border border-black/10 dark:border-white/10">
                        <span className="text-[10px]">🔥</span> {Math.round(meal.calories)} kcal
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#08705b]/10 dark:bg-[#10b981]/15 px-2.5 py-1 text-[11px] font-bold text-[#08705b] dark:text-[#34d399] border border-[#08705b]/20 dark:border-[#10b981]/30">
                        {Math.round(meal.proteinG)}g P
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#18b9d2]/10 dark:bg-[#38bdf8]/15 px-2.5 py-1 text-[11px] font-bold text-[#0b7788] dark:text-[#38bdf8] border border-[#18b9d2]/20 dark:border-[#38bdf8]/30">
                        {Math.round(meal.carbsG)}g C
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eb6a38]/10 dark:bg-[#eb6a38]/15 px-2.5 py-1 text-[11px] font-bold text-[#c74614] dark:text-[#f09e6c] border border-[#eb6a38]/20 dark:border-[#eb6a38]/30">
                        {Math.round(meal.fatG)}g F
                      </span>
                    </div>

                    {/* Occurrences Links */}
                    <div className="mt-3 pt-2.5 border-t border-brand-border/40 text-xs">
                      {occurrences.length === 1 ? (
                        <Link href={`/dashboard/${meal.id}`} className="font-semibold text-brand-green hover:underline">
                          View planned meal
                        </Link>
                      ) : (
                        <div className="flex flex-wrap gap-x-4 gap-y-2 font-semibold text-brand-green">
                          {occurrences.map((slot) => (
                            <Link key={slot.id} href={`/dashboard/${slot.id}`} className="hover:underline">
                              {slot.cycleScope === 'UPCOMING' ? 'Next week' : 'This week'} · {new Date(slot.scheduledDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <VerifiedRecipeCatalog search={librarySearch} mealType={libraryMealType} />

      {approvedInPlan.length > 0 && <h2 className="text-sm font-bold text-brand-text">Reusable recipes for your profile</h2>}

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
            The published recipe catalogue above is separate from meals with a complete reusable serving or case approval.
          </p>
        </div>
      ) : libraryMeals.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {libraryMeals.map((meal) => (
            <LibraryMealCard
              key={meal.id}
              meal={{ ...meal, alreadyPlannedInCycle: plannedLibraryIds.has(meal.id) }}
              onVerifier={setSelectedVerifier}
              onFavorite={toggleLibraryFavorite}
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

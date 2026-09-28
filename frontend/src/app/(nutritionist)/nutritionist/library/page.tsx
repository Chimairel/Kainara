'use client';

import { useRef, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Search, Soup, ShieldAlert } from 'lucide-react';
import api from '@/lib/axios';
import MealImage from '@/components/user/MealImage';
import type { PublicMealImage } from '@/types';

import {
  AVAILABLE_CONDITIONS,
  useNutritionistLibrary,
} from '@/features/nutritionist-library/useNutritionistLibrary';
import { MealApprovalsPanel } from '@/features/nutritionist-library/MealApprovalsPanel';
import { LibraryGridSkeleton } from '@/features/nutritionist-library/NutritionistLibrarySkeleton';
import type { LibraryMeal } from '@/features/nutritionist-library/useNutritionistLibrary';

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', total];
  }
  if (current >= total - 3) {
    return [1, 'ellipsis', total - 4, total - 3, total - 2, total - 1, total];
  }
  return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
}

export default function MealLibraryPage() {
  const [section, setSection] = useState<'recipes' | 'coverage'>('recipes');
  const [viewedMeal, setViewedMeal] = useState<LibraryMeal | null>(null);
  const [mealFlagReason, setMealFlagReason] = useState('');
  const [mealReleaseFindings, setMealReleaseFindings] = useState('');
  const [mealFlagBusy, setMealFlagBusy] = useState(false);
  const [mealFlagError, setMealFlagError] = useState<string | null>(null);
  const listScrollTop = useRef(0);
  const workspace = useNutritionistLibrary();
  const {
    meals,
    totalCount,
    page,
    setPage,
    totalPages,
    isLoading,
    fetchError,
    coverage,
    searchVal,
    setSearchVal,
    mealType,
    setMealType,
    conditionTag,
    setConditionTag,
    verifiedByMe,
    setVerifiedByMe,
    adminDraftsOnly,
    setAdminDraftsOnly,
    status,
    setStatus,
    fetchLibrary,
  } = workspace;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    const main = document.querySelector('main.portal-main');
    if (main) {
      main.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  async function changeMealFlag(action: 'flag' | 'release-flag') {
    if (!viewedMeal) return;
    setMealFlagBusy(true);
    setMealFlagError(null);
    try {
      await api.post(`/nutritionist/library/${viewedMeal.id}/${action}`, action === 'flag'
        ? { reason: mealFlagReason.trim() } : { rationale: mealReleaseFindings.trim() });
      const response = await api.get(`/nutritionist/library/${viewedMeal.id}`);
      if (response.data?.success) setViewedMeal({ ...viewedMeal, ...response.data.data });
      setMealFlagReason('');
      setMealReleaseFindings('');
      await fetchLibrary();
    } catch (error: unknown) {
      const response = error as { response?: { data?: { error?: string } } };
      setMealFlagError(response.response?.data?.error || 'The meal flag could not be updated. Reload and try again.');
    } finally {
      setMealFlagBusy(false);
    }
  }

  if (viewedMeal) {
    const source = viewedMeal.sourceRawRecipeCandidate;
    return (
      <div className="portal-page space-y-6">
        <button type="button" onClick={() => {
          setViewedMeal(null);
          requestAnimationFrame(() => document.querySelector('main.portal-main')?.scrollTo({ top: listScrollTop.current }));
        }}
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-green hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to meal library
        </button>
        <header className="flex flex-col gap-5 rounded-2xl border border-brand-border bg-brand-surface/60 p-5 md:flex-row md:items-center">
          <MealImage
            image={
              source?.sourceImageUrl
                ? {
                    url: source.sourceImageUrl,
                    altText: viewedMeal.mealName,
                    kind: 'EXACT',
                    attribution: {
                      sourcePageUrl: source.sourceUrl || undefined,
                    },
                  }
                : null
            }
            mealName={viewedMeal.mealName}
            mealType={viewedMeal.mealType}
            className="h-44 w-full rounded-2xl md:w-60 shrink-0"
            showAttributionLinks
            variant="detail"
          />
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-green">
              {viewedMeal.mealType} · {source?.sourceName === 'PANLASANG_PINOY' ? 'Panlasang Pinoy base recipe' : 'Recorded recipe'}
            </p>
            <h1 className="mt-2 font-display text-3xl font-black text-brand-text">{viewedMeal.mealName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={viewedMeal.baseVerification === 'VERIFIED' ? 'verified' : 'pending'} showIcon={false}>
                {viewedMeal.baseVerification === 'VERIFIED' ? 'Verified' : 'Review pending'}
              </Badge>
              {viewedMeal.baseVerification === 'VERIFIED' && (
                <span className="text-xs text-brand-muted">
                  {viewedMeal.baseVerificationBasis === 'PANLASANG_PINOY'
                    ? 'Established Panlasang Pinoy recipe source'
                    : 'Nutritionist reviewed base recipe'}
                </span>
              )}
            </div>
            {source?.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold text-brand-green underline">View original recipe ↗</a>}
            {viewedMeal.status === 'FLAGGED' && (
              <p className="mt-3 text-sm font-bold text-amber-800 dark:text-amber-300">
                Meal flagged · all serving variants and approvals are unavailable for reuse
              </p>
            )}
          </div>
          <a
            href="#meal-wide-review"
            className="inline-flex items-center gap-2 rounded-xl border border-amber-600/40 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-800 shadow-sm transition-colors hover:bg-amber-500/20 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25 md:ml-auto md:self-start"
          >
            <ShieldAlert className="h-4 w-4 text-amber-700 dark:text-amber-400" aria-hidden="true" />
            {viewedMeal.status === 'FLAGGED' ? 'Review meal flag' : 'Flag meal'}
          </a>
        </header>
        <section className="space-y-5 rounded-2xl border border-brand-border bg-brand-surface/60 p-5" aria-label="Meal details">
          <div>
            <h2 className="font-display text-xl font-bold text-brand-text">Recipe details</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-muted">{viewedMeal.description || 'No description recorded.'}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {([['Calories', `${viewedMeal.calories} kcal`], ['Protein', `${viewedMeal.proteinG} g`],
              ['Carbs', `${viewedMeal.carbsG} g`], ['Fat', `${viewedMeal.fatG} g`]] as const).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-brand-border/70 bg-brand-surface p-3 shadow-xs">
                <dt className="text-xs text-brand-muted">{label}</dt><dd className="mt-1 font-bold text-brand-text">{value}</dd>
              </div>
            ))}
          </dl>
          {viewedMeal.nutritionServingDescription && <p className="text-xs text-brand-muted">Serving: {viewedMeal.nutritionServingDescription}</p>}
          <div>
            <h3 className="text-sm font-bold text-brand-text">Ingredients</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {(viewedMeal.ingredients || []).map((ingredient) => (
                <li key={ingredient.id} className="rounded-lg border border-brand-border/70 bg-brand-surface px-3 py-2 text-xs text-brand-text shadow-xs">
                  {ingredient.ingredientName}{ingredient.quantity != null ? ` · ${ingredient.quantity} ${ingredient.unit || ''}` : ''}
                </li>
              ))}
            </ul>
            {!viewedMeal.ingredients?.length && <p className="mt-2 text-xs text-brand-muted">No ingredient snapshot recorded.</p>}
          </div>
          {viewedMeal.safetyReviews?.[0]?.evidenceSnapshot?.nutritionBasis && (
            <p className="text-xs text-brand-muted">Nutrition source notes: {viewedMeal.safetyReviews[0].evidenceSnapshot.nutritionBasis}</p>
          )}
        </section>
        <section id="meal-wide-review" className="scroll-mt-20 space-y-3 rounded-2xl border border-brand-border bg-brand-surface/60 p-5" aria-label="Meal-wide flag">
          <h2 className="font-display text-xl font-bold text-brand-text">Meal-wide review</h2>
          {viewedMeal.status === 'FLAGGED' ? (
            <>
              <p className="text-sm text-brand-muted">This base meal and every serving variant are unavailable. Recorded approvals remain intact; separately flagged approvals stay flagged after release.</p>
              {viewedMeal.flags?.filter((flag) => flag.status === 'PENDING').map((flag) => (
                <p key={flag.id} className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm font-medium text-amber-900 dark:text-amber-200">Flag reason: {flag.reason}</p>
              ))}
              <label htmlFor="meal-release-findings" className="block text-sm font-semibold text-brand-text">Independent review findings</label>
              <textarea
                id="meal-release-findings"
                value={mealReleaseFindings}
                onChange={(event) => setMealReleaseFindings(event.target.value)}
                minLength={10}
                maxLength={1000}
                rows={3}
                placeholder="Document clinical findings from independent review (at least 10 characters)..."
                className="w-full rounded-xl border border-brand-border/80 bg-brand-surface p-3 text-sm text-brand-text shadow-sm outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 placeholder:text-brand-muted/70"
              />
              <Button variant="secondary" disabled={mealFlagBusy || mealReleaseFindings.trim().length < 10} onClick={() => void changeMealFlag('release-flag')}>Release meal flag</Button>
            </>
          ) : (
            <>
              <p className="text-sm text-brand-muted">Flagging pauses this meal, its serving variants, and every associated approval. Current plan slots using it require revalidation.</p>
              <label htmlFor="meal-flag-reason" className="block text-sm font-semibold text-brand-text">Reason for flagging the meal</label>
              <textarea
                id="meal-flag-reason"
                value={mealFlagReason}
                onChange={(event) => setMealFlagReason(event.target.value)}
                minLength={10}
                maxLength={1000}
                rows={3}
                placeholder="State the reason for flagging this meal (at least 10 characters)..."
                className="w-full rounded-xl border border-brand-border/80 bg-brand-surface p-3 text-sm text-brand-text shadow-sm outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/20 placeholder:text-brand-muted/70"
              />
              <Button variant="secondary" disabled={mealFlagBusy || mealFlagReason.trim().length < 10} onClick={() => void changeMealFlag('flag')}>Flag entire meal</Button>
            </>
          )}
          {mealFlagError && <p role="alert" className="text-sm text-red-300">{mealFlagError}</p>}
        </section>
        <MealApprovalsPanel key={`${viewedMeal.id}-${viewedMeal.status}`} mealId={viewedMeal.id} />
      </div>
    );
  }

  return (
    <div className="portal-page space-y-6">
      {/* Header */}
      <PortalPageHeader
        icon={BookOpen}
        eyebrow="Meal intelligence"
        title="Meal library"
        description="Browse base recipes and their separate health-context approvals. A flagged base meal and all its approvals are unavailable until independent review releases the meal."
        meta={
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-brand-muted">
            {totalCount} records
          </span>
        }
      />

      <nav
        aria-label="Library sections"
        className="flex w-fit items-center gap-1.5 rounded-2xl border border-brand-border/70 bg-brand-surface/75 p-1.5 shadow-sm backdrop-blur-md"
      >
        {(['recipes', 'coverage'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSection(value)}
            aria-pressed={section === value}
            className={`group relative flex items-center justify-center gap-1.5 rounded-xl px-4 py-2 font-display text-xs font-extrabold outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-brand-green ${
              section === value
                ? 'bg-brand-accent text-[#07100d] font-black shadow-sm'
                : 'text-brand-muted hover:bg-brand-bgAlt/80 hover:text-brand-text'
            }`}
          >
            {value === 'recipes' ? 'Recipes' : 'Serving coverage'}
          </button>
        ))}
      </nav>
      {section === 'coverage' && coverage && (
        <section aria-labelledby="coverage-heading" className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">
                Coverage monitor
              </p>
              <h2 id="coverage-heading" className="font-display text-lg font-black text-brand-text">
                Seven-day library readiness
              </h2>
            </div>
            <p className="text-xs text-brand-muted">
              {coverage.certifiedMeals} current certified meals · {coverage.requiredPerSlot} required per slot
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {coverage.profiles.map((profile) => (
              <Card key={profile.key} className="border-brand-border/60 bg-brand-surface/65 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-extrabold text-brand-text">{profile.label}</p>
                    <p className="mt-1 text-[10px] text-brand-muted">Lowest slot: {profile.minimumPerSlot}</p>
                  </div>
                  <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                    {profile.weekReady ? 'Recipe variety' : 'Coverage gap'}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-1 text-center">
                  {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((slot) => (
                    <div key={slot} className="rounded-lg border border-brand-border/50 bg-brand-bg/50 px-1 py-2">
                      <dt className="text-[8px] font-bold uppercase text-brand-muted">{slot.slice(0, 1)}</dt>
                      <dd className="mt-0.5 font-mono text-xs font-black text-brand-text">{profile.counts[slot]}</dd>
                    </div>
                  ))}
                </dl>
                <details className="mt-3 text-xs">
                  <summary>Serving coverage by daily target</summary>
                  <p className="my-2 text-brand-muted">
                    Certify separate serving variants to fill gaps; recipe totals alone do not establish target fit.
                  </p>
                  {profile.servingCoverage?.map((row) => (
                    <p key={row.dailyCalorieTarget} className="mt-1">
                      {row.dailyCalorieTarget} kcal: B {row.counts.BREAKFAST} · L {row.counts.LUNCH} · D{' '}
                      {row.counts.DINNER} — {row.weekReady ? 'Covered' : 'Needs servings'}
                    </p>
                  ))}
                </details>
              </Card>
            ))}
          </div>
          <Card className="overflow-hidden border-brand-border/60 bg-brand-surface/65 p-0">
            <div className="border-b border-brand-border/60 px-4 py-3">
              <h3 className="text-sm font-extrabold text-brand-text">Combined restriction matrix</h3>
              <p className="mt-1 text-[11px] text-brand-muted">
                Each cell shows the lowest available main-meal slot. Hover or focus a cell for breakfast, lunch, and
                dinner counts.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-brand-bg/45">
                    <th
                      scope="col"
                      className="sticky left-0 z-10 border-r border-brand-border/50 bg-brand-bg px-4 py-3 font-mono text-[9px] uppercase tracking-wider text-brand-muted"
                    >
                      Condition
                    </th>
                    {coverage.combinationColumns.map((column) => (
                      <th
                        key={column.key}
                        scope="col"
                        className="px-3 py-3 text-center text-[10px] font-extrabold text-brand-muted"
                      >
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coverage.combinationMatrix.map((row) => (
                    <tr key={row.key} className="border-t border-brand-border/50">
                      <th
                        scope="row"
                        className="sticky left-0 z-10 border-r border-brand-border/50 bg-brand-surface px-4 py-3 text-xs font-extrabold text-brand-text"
                      >
                        {row.label}
                      </th>
                      {row.cells.map((cell) => {
                        const detail = `Breakfast ${cell.counts.BREAKFAST}, lunch ${cell.counts.LUNCH}, dinner ${cell.counts.DINNER}`;
                        return (
                          <td key={cell.key} className="px-2 py-2 text-center">
                            <span
                              tabIndex={0}
                              title={detail}
                              aria-label={`${row.label} and ${cell.label}: ${cell.minimumPerSlot} lowest-slot meals. ${detail}. ${cell.weekReady ? 'Recipe variety' : 'Coverage gap'}.`}
                              className={`inline-flex min-w-16 items-center justify-center gap-1 rounded-xl border px-2 py-2 font-mono text-[10px] font-black outline-none transition focus:ring-2 focus:ring-brand-cyan/40 ${cell.weekReady ? 'border-brand-green/35 bg-brand-green/10 text-brand-green' : 'border-status-warning-text/35 bg-status-warning-bg/15 text-status-warning-text'}`}
                            >
                              {cell.minimumPerSlot}
                              <span aria-hidden="true">/7</span>
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <div className="grid gap-3 lg:grid-cols-3" aria-label="Structured combined profile coverage">
            {coverage.structuredProfiles.map((profile) => (
              <Card key={profile.key} className="border-brand-border/60 bg-brand-surface/65 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-cyan">
                      Structured profile
                    </p>
                    <p className="mt-1 text-sm font-extrabold text-brand-text">{profile.label}</p>
                  </div>
                  <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                    {profile.weekReady ? 'Recipe variety' : 'Coverage gap'}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-1 text-center">
                  {(['BREAKFAST', 'LUNCH', 'DINNER'] as const).map((slot) => (
                    <div key={slot} className="rounded-lg border border-brand-border/50 bg-brand-bg/50 px-1 py-2">
                      <dt className="text-[8px] font-bold uppercase text-brand-muted">{slot.slice(0, 1)}</dt>
                      <dd className="mt-0.5 font-mono text-xs font-black text-brand-text">{profile.counts[slot]}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            ))}
          </div>
        </section>
      )}

      <div className={section === 'recipes' ? 'space-y-5' : 'hidden'}>
        {/* Top Filter Panel */}
        <Card className="portal-filter-panel rounded-[22px] border-brand-border/70 bg-brand-surface/90 p-5 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search bar */}
            <div className="md:col-span-2">
              <label htmlFor="library-search" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
                Search meal name
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" aria-hidden="true" />
                <input
                  id="library-search"
                  name="search"
                  type="text"
                  placeholder="Search recipes (e.g. Tinola, Sinigang)..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 pl-10 pr-9 text-xs text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10 placeholder:text-brand-muted/60"
                />
                {searchVal && (
                  <button
                    type="button"
                    aria-label="Clear meal search"
                    onClick={() => setSearchVal('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-muted hover:text-brand-text text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Meal Type */}
            <div>
              <label htmlFor="library-meal-type" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
                Meal Type
              </label>
              <select
                id="library-meal-type"
                value={mealType}
                onChange={(e) => {
                  setMealType(e.target.value);
                  setPage(1);
                }}
                className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-3 text-xs text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10"
              >
                <option value="All">All Types</option>
                <option value="BREAKFAST">Breakfast</option>
                <option value="LUNCH">Lunch</option>
                <option value="DINNER">Dinner</option>
                <option value="SNACK">Snack</option>
              </select>
            </div>

            {/* Condition Tag */}
            <div>
              <label htmlFor="library-condition" className="block text-xs font-bold text-brand-muted uppercase mb-1.5">
                Condition Tag
              </label>
              <select
                id="library-condition"
                value={conditionTag}
                onChange={(e) => {
                  setConditionTag(e.target.value);
                  setPage(1);
                }}
                className="h-11 w-full rounded-2xl border border-brand-border/70 bg-brand-surface/75 px-3 text-xs text-brand-text outline-none transition focus:border-brand-green/60 focus:ring-4 focus:ring-brand-green/10"
              >
                <option value="All">All Conditions</option>
                {AVAILABLE_CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-3 border-t border-brand-border/40">
            <div className="flex flex-wrap items-center gap-4">
              <label htmlFor="library-meal-status" className="flex items-center gap-2 text-xs font-bold text-brand-text">
                Meal status
                <select
                  id="library-meal-status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value as typeof status);
                    setPage(1);
                  }}
                  className="rounded-xl border border-brand-border bg-brand-surface px-3 py-1.5 text-xs text-brand-text shadow-xs outline-none focus:border-brand-green"
                >
                  <option value="ALL">All meals</option>
                  <option value="APPROVED">Available</option>
                  <option value="FLAGGED">Flagged</option>
                </select>
              </label>

              {/* Owner filter */}
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-brand-text">
                <input
                  type="checkbox"
                  checked={adminDraftsOnly}
                  onChange={(event) => {
                    setAdminDraftsOnly(event.target.checked);
                    setPage(1);
                  }}
                  className="h-4 w-4 rounded border-brand-border bg-brand-surface text-brand-green focus:ring-brand-green"
                />
                Admin drafts awaiting evidence review
              </label>

              <label
                htmlFor="library-verified-by-me"
                className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-brand-text"
              >
                <input
                  id="library-verified-by-me"
                  type="checkbox"
                  checked={verifiedByMe}
                  onChange={(e) => {
                    setVerifiedByMe(e.target.checked);
                    setPage(1);
                  }}
                  className="h-4 w-4 rounded border-brand-border bg-brand-surface text-brand-green focus:ring-brand-green"
                />
                Show only meals verified by me
              </label>
            </div>

            {totalCount > 0 && (
              <span className="text-xs text-brand-muted shrink-0">
                {totalCount} total {totalCount === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>
        </Card>

        {fetchError && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{fetchError}</span>
          </div>
        )}

        {/* Main Meal Grid / Table */}
        {isLoading ? (
          <LibraryGridSkeleton count={6} />
        ) : meals.length === 0 ? (
          <Card className="p-16 text-center border-brand-border/40 bg-brand-surface/30 flex flex-col items-center rounded-[22px]">
            <Soup className="w-12 h-12 text-brand-muted mb-4" />
            <h3 className="text-lg font-bold text-brand-text font-display">No Meals Found</h3>
            <p className="text-sm text-brand-muted mt-1 max-w-md mx-auto">
              Try adjusting your search query, selecting different filters, or checking back later.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {meals.map((meal) => {
                const isAdminDraft =
                  meal.safetyEvidenceStatus === 'INCOMPLETE' &&
                  meal.safetyReviews?.some((review) => review.reasonCode === 'ADMIN_AUTHORED_DRAFT');

                const image: PublicMealImage | null = meal.sourceRawRecipeCandidate?.sourceImageUrl
                  ? {
                      url: meal.sourceRawRecipeCandidate.sourceImageUrl,
                      altText: meal.mealName,
                      kind: 'EXACT',
                      attribution: {
                        sourcePageUrl: meal.sourceRawRecipeCandidate.sourceUrl || undefined,
                      },
                    }
                  : null;

                return (
                  <article
                    key={meal.id}
                    className="flex flex-col justify-between rounded-[22px] border border-brand-border/70 bg-brand-surface p-5 shadow-sm transition-all duration-200 hover:border-brand-border-hover hover:shadow-md"
                  >
                    <div className="space-y-3.5">
                      <MealImage
                        image={image}
                        mealName={meal.mealName}
                        mealType={meal.mealType}
                        className="h-40 w-full rounded-2xl"
                        showAttributionLinks
                      />

                      {/* Slot and calories row */}
                      <div className="flex items-center justify-between text-xs font-bold text-brand-green">
                        <span className="font-display tracking-wider uppercase">{meal.mealType}</span>
                        <span className="font-mono">{meal.calories} kcal</span>
                      </div>

                      {/* Verification & Status Badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant={
                            meal.status === 'FLAGGED'
                              ? 'pending'
                              : meal.baseVerification === 'VERIFIED'
                                ? 'verified'
                                : 'pending'
                          }
                          showIcon={false}
                          className="text-[10px]"
                        >
                          {meal.status === 'FLAGGED'
                            ? 'Flagged'
                            : meal.baseVerification === 'VERIFIED'
                              ? 'Verified'
                              : 'Review pending'}
                        </Badge>
                        {isAdminDraft && (
                          <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                            Admin draft
                          </span>
                        )}
                        {meal.suitableConditions && meal.suitableConditions.length > 0 && (
                          <span className="rounded-full border border-brand-border/60 bg-brand-bgAlt/50 px-2 py-0.5 text-[10px] font-semibold text-brand-muted">
                            {meal.suitableConditions.length}{' '}
                            {meal.suitableConditions.length === 1 ? 'condition' : 'conditions'}
                          </span>
                        )}
                      </div>

                      {/* Meal Title & Description */}
                      <div>
                        <h3 className="font-display text-base font-bold leading-snug text-brand-text">
                          {meal.mealName}
                        </h3>
                        {meal.description && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-brand-muted">
                            {meal.description}
                          </p>
                        )}
                      </div>

                      {/* Macro summary */}
                      <p className="text-xs font-medium text-brand-muted">
                        Protein <span className="font-bold text-brand-text">{meal.proteinG}g</span> · Carbs{' '}
                        <span className="font-bold text-brand-text">{meal.carbsG}g</span> · Fat{' '}
                        <span className="font-bold text-brand-text">{meal.fatG}g</span>
                      </p>
                    </div>

                    {/* Card Footer: Source & View Button */}
                    <div className="mt-4 flex items-center justify-between border-t border-brand-border/40 pt-3">
                      <div className="text-[11px] text-brand-muted">
                        <span className="line-clamp-1 font-medium">
                          {meal.sourceRawRecipeCandidate?.sourceName === 'PANLASANG_PINOY'
                            ? 'Panlasang Pinoy base recipe'
                            : isAdminDraft
                              ? 'Admin recipe draft'
                              : 'Recorded recipe'}
                        </span>
                        <span className="mt-0.5 block text-[10px] text-brand-muted/80">Used {meal.usageCount}x</span>
                      </div>

                      <Button
                        variant="secondary"
                        onClick={() => {
                          const main = document.querySelector('main.portal-main');
                          listScrollTop.current = main?.scrollTop ?? 0;
                          setMealFlagError(null);
                          setMealFlagReason('');
                          setMealReleaseFindings('');
                          setViewedMeal(meal);
                          requestAnimationFrame(() => main?.scrollTo({ top: 0 }));
                        }}
                        className="!h-8 !px-3.5 text-xs font-semibold"
                      >
                        View
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <nav
                aria-label="Meal library pagination"
                className="flex flex-col items-center justify-between gap-4 border-t border-brand-border/40 pt-6 sm:flex-row"
              >
                <p className="text-xs text-brand-muted">
                  Showing <span className="font-bold text-brand-text">{(page - 1) * 20 + 1}</span> to{' '}
                  <span className="font-bold text-brand-text">{Math.min(page * 20, totalCount)}</span> of{' '}
                  <span className="font-bold text-brand-text">{totalCount}</span> recipes
                </p>

                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <Button
                    variant="secondary"
                    disabled={page <= 1}
                    onClick={() => handlePageChange(Math.max(1, page - 1))}
                    className="!h-8 !px-2.5 text-xs flex items-center gap-1"
                    aria-label="Go to previous page"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Previous</span>
                  </Button>

                  {getPageNumbers(page, totalPages).map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span key={`ellipsis-${idx}`} className="px-1 text-xs text-brand-muted select-none">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => handlePageChange(p)}
                        aria-current={p === page ? 'page' : undefined}
                        className={`h-8 min-w-8 rounded-xl px-2 text-xs font-bold transition-all duration-150 ${
                          p === page
                            ? 'border border-brand-green bg-brand-green text-white dark:border-brand-accent dark:bg-brand-accent dark:text-black shadow-sm'
                            : 'border border-brand-border bg-brand-surface text-brand-muted hover:border-brand-border-hover hover:text-brand-text'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                  <Button
                    variant="secondary"
                    disabled={page >= totalPages}
                    onClick={() => handlePageChange(Math.min(totalPages, page + 1))}
                    className="!h-8 !px-2.5 text-xs flex items-center gap-1"
                    aria-label="Go to next page"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Button>
                </div>
              </nav>
            )}
          </div>
        )}

        {/* ──────────────────────────────────────────────────────── */}
        {/* MODALS SECTION */}
        {/* ──────────────────────────────────────────────────────── */}
      </div>
    </div>
  );
}

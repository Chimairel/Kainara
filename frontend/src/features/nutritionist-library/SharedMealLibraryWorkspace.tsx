'use client';

import SharedLibraryCoverage from './SharedLibraryCoverage';

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { Soup, ShieldAlert } from 'lucide-react';

import LibraryRecipeDetail from './sections/LibraryRecipeDetail';
import LibraryFilterSection from './sections/LibraryFilterSection';
import LibraryResultsSection from './sections/LibraryResultsSection';
import { useSharedMealLibraryModel } from './sections/useSharedMealLibraryModel';
export default function SharedMealLibraryWorkspace({
  role = 'nutritionist',
  active = true,
  embedded = false,
}: {
  role?: 'admin' | 'nutritionist';
  active?: boolean;
  embedded?: boolean;
}) {
  const model = useSharedMealLibraryModel({ role, active, embedded });
  const { isAdmin, totalCount, setSection, section, coverage, fetchError, detailError } = model;
  if (model.viewedMeal) return <LibraryRecipeDetail model={model} />;
  return (
    <div className={`${embedded ? '' : 'portal-page '}space-y-6`}>
      {/* Header */}
      <PortalPageHeader
        headingLevel={embedded ? 'h2' : 'h1'}
        icon={Soup}
        eyebrow="Meal intelligence"
        title="Meal library"
        description={
          isAdmin
            ? 'Shared with the nutritionist workspace. Browse recipes and flag meals that need nutritionist review.'
            : 'Browse base recipes and their separate health-context approvals. A flagged base meal and all its approvals are unavailable until independent review releases the meal.'
        }
        meta={
          <span className="rounded-full border border-brand-border/70 bg-brand-surface/60 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-brand-muted dark:border-[#173e33] dark:bg-[#0e271f]">
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
            {value === 'recipes' ? 'Recipes' : 'Recipe coverage'}
          </button>
        ))}
      </nav>
      {section === 'coverage' && coverage && <SharedLibraryCoverage coverage={coverage} />}

      <div className={section === 'recipes' ? 'space-y-5' : 'hidden'}>
        {/* Top Filter Panel */}
        <LibraryFilterSection model={model} />

        {(fetchError || detailError) && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm font-semibold text-status-error-text"
          >
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{fetchError || detailError}</span>
          </div>
        )}

        {/* Main Meal Grid / Table */}
        <LibraryResultsSection model={model} />

        {/* ──────────────────────────────────────────────────────── */}
        {/* MODALS SECTION */}
        {/* ──────────────────────────────────────────────────────── */}
      </div>
    </div>
  );
}

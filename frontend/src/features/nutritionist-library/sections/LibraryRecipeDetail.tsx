'use client';

import LibrarySafetyReview from '@/features/nutritionist-library/LibrarySafetyReview';
import MealReviewPanel from '../MealReviewPanel';
import RecipeDerivationForm from '@/features/nutritionist-library/RecipeDerivationForm';

import Badge from '@/components/ui/Badge';

import { ArrowLeft, ShieldAlert } from 'lucide-react';

import MealImage from '@/components/user/MealImage';

import { MealApprovalsPanel } from '@/features/nutritionist-library/MealApprovalsPanel';

import type { useSharedMealLibraryModel } from './useSharedMealLibraryModel';
type Props = {
  model: Pick<
    ReturnType<typeof useSharedMealLibraryModel>,
    | 'embedded'
    | 'setViewedMeal'
    | 'listScrollTop'
    | 'viewedMeal'
    | 'isAdmin'
    | 'openMeal'
    | 'workspace'
    | 'fetchLibrary'
  >;
};
export default function LibraryRecipeDetail({ model }: Props) {
  const { embedded, setViewedMeal, listScrollTop, viewedMeal, isAdmin, openMeal, workspace, fetchLibrary } = model;
  if (!viewedMeal) return null;
  const source = viewedMeal.sourceRawRecipeCandidate;
  return (
    <>
      <div className={`${embedded ? '' : 'portal-page '}space-y-6`}>
        <button
          type="button"
          onClick={() => {
            setViewedMeal(null);
            requestAnimationFrame(() =>
              document.querySelector('main.portal-main')?.scrollTo({ top: listScrollTop.current })
            );
          }}
          className="inline-flex items-center gap-2 text-sm font-bold text-brand-green hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to meal library
        </button>
        <header className="flex flex-col gap-5 rounded-2xl border border-brand-border bg-brand-surface/60 p-5 md:flex-row md:items-center">
          <MealImage
            image={
              viewedMeal.adaptedImageUrl || source?.sourceImageUrl
                ? {
                    url: viewedMeal.adaptedImageUrl || source!.sourceImageUrl!,
                    altText: viewedMeal.mealName,
                    kind: 'EXACT',
                    attribution: {
                      sourcePageUrl: source?.sourceUrl || undefined,
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
              {viewedMeal.mealType} ·{' '}
              {source?.sourceName === 'PANLASANG_PINOY' ? 'Panlasang Pinoy base recipe' : 'Recorded recipe'}
            </p>
            <h1 className="mt-2 font-display text-3xl font-black text-brand-text">{viewedMeal.mealName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  viewedMeal.status !== 'FLAGGED' && viewedMeal.baseVerification === 'VERIFIED' ? 'verified' : 'pending'
                }
                showIcon={false}
              >
                {viewedMeal.status === 'FLAGGED'
                  ? viewedMeal.reviewLineage?.state === 'QUARANTINED'
                    ? 'Quarantined'
                    : 'Pending re-review'
                  : viewedMeal.baseVerification === 'VERIFIED'
                    ? 'Verified'
                    : 'Review pending'}
              </Badge>
              {viewedMeal.status !== 'FLAGGED' && viewedMeal.baseVerification === 'VERIFIED' && (
                <span className="text-xs text-brand-muted">
                  {viewedMeal.baseVerificationBasis === 'PANLASANG_PINOY'
                    ? 'Established Panlasang Pinoy recipe source'
                    : 'RND reviewed base recipe'}
                </span>
              )}
            </div>
            {source?.sourceUrl && (
              <a
                href={source.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-semibold text-brand-green underline"
              >
                View original recipe ↗
              </a>
            )}
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
        <section
          className="space-y-5 rounded-2xl border border-brand-border bg-brand-surface/60 p-5"
          aria-label="Meal details"
        >
          <div>
            <h2 className="font-display text-xl font-bold text-brand-text">Recipe details</h2>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-brand-muted">
              {viewedMeal.description || 'No description recorded.'}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(
              [
                ['Calories', `${viewedMeal.calories} kcal`],
                ['Protein', `${viewedMeal.proteinG} g`],
                ['Carbs', `${viewedMeal.carbsG} g`],
                ['Fat', `${viewedMeal.fatG} g`],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-xl border border-brand-border/70 bg-brand-surface p-3 shadow-xs">
                <dt className="text-xs text-brand-muted">{label}</dt>
                <dd className="mt-1 font-bold text-brand-text">{value}</dd>
              </div>
            ))}
          </dl>
          {viewedMeal.nutritionServingDescription && (
            <p className="text-xs text-brand-muted">Serving: {viewedMeal.nutritionServingDescription}</p>
          )}
          <div>
            <h3 className="text-sm font-bold text-brand-text">Ingredients</h3>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {(viewedMeal.ingredients || []).map((ingredient) => (
                <li
                  key={ingredient.id}
                  className="rounded-lg border border-brand-border/70 bg-brand-surface px-3 py-2 text-xs text-brand-text shadow-xs"
                >
                  {ingredient.ingredientName}
                  {ingredient.quantity != null ? ` · ${ingredient.quantity} ${ingredient.unit || ''}` : ''}
                </li>
              ))}
            </ul>
            {!viewedMeal.ingredients?.length && (
              <p className="mt-2 text-xs text-brand-muted">No ingredient snapshot recorded.</p>
            )}
          </div>
          {viewedMeal.safetyReviews?.[0]?.evidenceSnapshot?.nutritionBasis && (
            <p className="text-xs text-brand-muted">
              Nutrition source notes: {viewedMeal.safetyReviews[0].evidenceSnapshot.nutritionBasis}
            </p>
          )}
        </section>
        {viewedMeal.parentMeal && (
          <p className="text-sm text-brand-muted">
            {viewedMeal.derivationKind === 'ADAPTED' ? 'Adapted from' : 'Serving version of'}{' '}
            {viewedMeal.parentMeal.mealName}. This draft has its own review history and approvals.
          </p>
        )}
        {!isAdmin && (
          <LibrarySafetyReview
            key={`safety-${viewedMeal.id}-${viewedMeal.safetyEvidenceRevision}`}
            meal={viewedMeal}
            refresh={async () => {
              await openMeal(viewedMeal);
              await workspace.fetchLibrary();
            }}
          />
        )}
        {!isAdmin && viewedMeal.status !== 'FLAGGED' && (
          <RecipeDerivationForm
            key={`derivation-${viewedMeal.id}`}
            meal={viewedMeal}
            onCreated={(id) => {
              void openMeal({ ...viewedMeal, id });
              void fetchLibrary();
            }}
          />
        )}
        <MealReviewPanel
          key={`review-${viewedMeal.id}`}
          meal={viewedMeal}
          isAdmin={isAdmin}
          refresh={async () => {
            await openMeal(viewedMeal);
            await workspace.fetchLibrary();
          }}
        />
        <>{!isAdmin && <MealApprovalsPanel key={`${viewedMeal.id}-${viewedMeal.status}`} mealId={viewedMeal.id} />}</>
      </div>
    </>
  );
}

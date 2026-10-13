'use client';

import { useEffect, useRef, useState } from 'react';
import { formatMealTitle } from '@/lib/meal-title';
import LibrarySafetyReview from '../LibrarySafetyReview';
import MealReviewPanel from '../MealReviewPanel';
import RecipeDerivationForm from '../RecipeDerivationForm';
import RecipeCaseHistory from '../RecipeCaseHistory';
import LibraryMealHeader from './LibraryMealHeader';
import LibraryMealVerifier from './LibraryMealVerifier';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import { ArrowLeft } from '@/components/ui/icons';
import type { useSharedMealLibraryModel } from './useSharedMealLibraryModel';

type DetailSection = 'details' | 'approvals';
type Props = {
  model: Pick<ReturnType<typeof useSharedMealLibraryModel>,
    'embedded' | 'setViewedMeal' | 'listScrollTop' | 'viewedMeal' | 'isAdmin' | 'openMeal' | 'workspace' | 'fetchLibrary'>;
};

export default function LibraryRecipeDetail({ model }: Props) {
  const { embedded, setViewedMeal, listScrollTop, viewedMeal, isAdmin, openMeal, workspace, fetchLibrary } = model;
  const [flagOpen, setFlagOpen] = useState(false);
  const [section, setSection] = useState<DetailSection>('details');
  const flagTrigger = useRef<HTMLDivElement>(null);
  const changeFlagOpen = (open: boolean) => {
    setFlagOpen(open);
    if (!open) requestAnimationFrame(() => flagTrigger.current?.querySelector('button')?.focus({ preventScroll: true }));
  };
  useEffect(() => {
    setFlagOpen(false);
    setSection('details');
  }, [viewedMeal?.id, viewedMeal?.status, isAdmin]);
  if (!viewedMeal) return null;
  const source = viewedMeal.sourceRawRecipeCandidate;
  const held = viewedMeal.status === 'FLAGGED';
  const refresh = async () => {
    await openMeal(viewedMeal);
    await workspace.fetchLibrary();
  };


  return (
    <div className={`${embedded ? '' : 'portal-page '}space-y-6`}>
      <div className="flex items-center justify-between gap-4">
        <button type="button" onClick={() => {
          setViewedMeal(null);
          requestAnimationFrame(() => document.querySelector('main.portal-main')?.scrollTo({ top: listScrollTop.current }));
        }} className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-muted hover:text-brand-text">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Meal library
        </button>

      </div>
      <LibraryMealHeader meal={viewedMeal} onFlag={() => changeFlagOpen(true)} flagTrigger={flagTrigger} />
      {held && <p className="text-sm font-semibold text-status-warning-text">This meal and its serving variants are withheld. Its approvals cannot be reused until the meal is released.</p>}
      <div className="border-b border-brand-border pb-5 pt-2">
        <WorkspaceTabs<DetailSection> value={section} onChange={setSection} label="Meal detail sections" level="secondary"
          items={[{ value: 'details', label: 'Meal details' }, { value: 'approvals', label: 'Approvals' }]} />
      </div>
      <div className="rounded-2xl bg-brand-surface p-5 shadow-card sm:p-7">
        <div hidden={section !== 'approvals'}>
          <RecipeCaseHistory key={`${viewedMeal.id}:${isAdmin}`} mealId={viewedMeal.id} role={isAdmin ? 'admin' : 'nutritionist'} approvalsOnly />
        </div>
        <div hidden={section !== 'details'} className="space-y-8">
          <section aria-label="Meal details" className="space-y-6">
            <LibraryMealVerifier key={viewedMeal.id} meal={viewedMeal} />
            <div>
              <h2 className="font-display text-xl font-bold">Meal details</h2>
              {source?.sourceUrl && <a href={source.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-brand-green underline underline-offset-4">Original source ↗</a>}
              <p className="mt-3 max-w-prose whitespace-pre-line text-sm leading-7 text-brand-muted">{viewedMeal.description || 'No description recorded.'}</p>
              {viewedMeal.nutritionServingDescription && <p className="mt-4 text-sm font-semibold">Serving: {viewedMeal.nutritionServingDescription}</p>}
            </div>
            <div className="border-t border-brand-border pt-6">
              <h3 className="font-display text-lg font-bold">Ingredients</h3>
              <ul className="mt-3 grid gap-x-8 sm:grid-cols-2">
                {(viewedMeal.ingredients || []).map(ingredient => <li key={ingredient.id} className="border-b border-brand-border py-3 text-sm leading-6">
                  {ingredient.ingredientName}{ingredient.quantity != null ? <span className="ml-2 text-brand-muted">{ingredient.quantity} {ingredient.unit || ''}</span> : ''}
                </li>)}
              </ul>
              {!viewedMeal.ingredients?.length && <p className="mt-3 text-sm text-brand-muted">No ingredient snapshot recorded.</p>}
            </div>
            {viewedMeal.safetyReviews?.[0]?.evidenceSnapshot?.nutritionBasis && <p className="text-sm text-brand-muted">Nutrition source notes: {viewedMeal.safetyReviews[0].evidenceSnapshot.nutritionBasis}</p>}
            {viewedMeal.image?.attribution && <p className="text-xs leading-5 text-brand-muted">
              Photo: {viewedMeal.image.attribution.creator || 'Recorded source'}
              {viewedMeal.image.attribution.sourcePageUrl && <> · <a className="underline underline-offset-4" href={viewedMeal.image.attribution.sourcePageUrl} target="_blank" rel="noopener noreferrer">Image source</a></>}
              {viewedMeal.image.attribution.licenseUrl && <> · <a className="underline underline-offset-4" href={viewedMeal.image.attribution.licenseUrl} target="_blank" rel="noopener noreferrer">{viewedMeal.image.attribution.licenseCode || 'License'}</a></>}
            </p>}
            {viewedMeal.parentMeal && <p className="text-sm text-brand-muted">{viewedMeal.derivationKind === 'ADAPTED' ? 'Adapted from' : 'Serving version of'} {formatMealTitle(viewedMeal.parentMeal.mealName)}. This draft has its own review history and approvals.</p>}
          </section>
          {!isAdmin && <LibrarySafetyReview key={`safety-${viewedMeal.id}-${viewedMeal.safetyEvidenceRevision}`} meal={viewedMeal} refresh={refresh} />}
          {!isAdmin && !held && <RecipeDerivationForm key={`derivation-${viewedMeal.id}`} meal={viewedMeal} onCreated={id => { void openMeal({ ...viewedMeal, id }); void fetchLibrary(); }} />}
        </div>
        <div hidden={section !== 'details' || !held}>
          <MealReviewPanel embedded key={`review-${viewedMeal.id}`} meal={viewedMeal} isAdmin={isAdmin} flagOpen={flagOpen} onFlagOpenChange={changeFlagOpen} refresh={refresh} />
        </div>
      </div>
    </div>
  );
}

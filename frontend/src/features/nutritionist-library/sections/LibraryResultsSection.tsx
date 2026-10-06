'use client';

import MealLibraryLayout from '@/components/shared/MealLibraryLayout';

import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';

import { Soup } from 'lucide-react';

import RecipeLibraryCard from '@/features/meals/RecipeLibraryCard';
import type { PublicMealImage } from '@/types';

import { LibraryGridSkeleton } from '@/features/nutritionist-library/NutritionistLibrarySkeleton';

import type { useSharedMealLibraryModel } from './useSharedMealLibraryModel';
type Props = {
  model: Pick<
    ReturnType<typeof useSharedMealLibraryModel>,
    'isLoading' | 'meals' | 'viewingMealId' | 'openMeal' | 'totalPages' | 'page' | 'handlePageChange'
  >;
};
export default function LibraryResultsSection({ model }: Props) {
  const { isLoading, meals, viewingMealId, openMeal, totalPages, page, handlePageChange } = model;
  return (
    <>
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
          <MealLibraryLayout>
            {meals.map((meal) => {
              const isAdminDraft =
                meal.safetyEvidenceStatus === 'INCOMPLETE' &&
                meal.safetyReviews?.some((review) => review.reasonCode === 'ADMIN_AUTHORED_DRAFT');

              const image: PublicMealImage | null =
                meal.adaptedImageUrl || meal.sourceRawRecipeCandidate?.sourceImageUrl
                  ? {
                      url: meal.adaptedImageUrl || meal.sourceRawRecipeCandidate!.sourceImageUrl!,
                      altText: meal.mealName,
                      kind: 'EXACT',
                      attribution: {
                        sourcePageUrl: meal.sourceRawRecipeCandidate?.sourceUrl || undefined,
                      },
                    }
                  : null;

              return (
                <RecipeLibraryCard
                  key={meal.id}
                  variant="nutritionist"
                  name={meal.mealName}
                  mealType={meal.mealType}
                  image={image}
                  description={meal.description}
                  calories={meal.calories}
                  proteinG={meal.proteinG}
                  carbsG={meal.carbsG}
                  fatG={meal.fatG}
                  badges={
                    <>
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
                        <span className="rounded-full border border-[#a64600]/30 bg-[#8c3b00] px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs">
                          Admin draft
                        </span>
                      )}
                    </>
                  }
                  details={
                    meal.suitableConditions?.length ? (
                      <p className="mt-1 text-[11px] text-brand-muted">
                        {meal.suitableConditions.length}{' '}
                        {meal.suitableConditions.length === 1 ? 'condition' : 'conditions'}
                      </p>
                    ) : undefined
                  }
                  footer={
                    <div className="flex items-center justify-between gap-2">
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
                        disabled={viewingMealId !== null}
                        onClick={() => void openMeal(meal)}
                        className="!h-8 !px-3.5 text-xs font-semibold"
                      >
                        {viewingMealId === meal.id ? 'Opening…' : 'View'}
                      </Button>
                    </div>
                  }
                />
              );
            })}
          </MealLibraryLayout>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <Pagination
              page={page}
              pageCount={totalPages}
              busy={isLoading}
              onPageChange={handlePageChange}
              label="Meal library pagination"
              showNumbers
            />
          )}
        </div>
      )}
    </>
  );
}

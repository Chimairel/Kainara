import NutritionistReviewsSkeleton from '@/features/nutritionist-reviews/NutritionistReviewsSkeleton';

export default function NutritionistPortalLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <NutritionistReviewsSkeleton />
      </div>
    </div>
  );
}

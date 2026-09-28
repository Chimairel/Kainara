import ApprovedReviewsSkeleton from '@/features/nutritionist-reviews/ApprovedReviewsSkeleton';

export default function ApprovedReviewsLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <ApprovedReviewsSkeleton />
      </div>
    </div>
  );
}

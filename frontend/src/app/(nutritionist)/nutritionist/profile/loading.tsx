import NutritionistProfileSkeleton from '@/features/profile/NutritionistProfileSkeleton';

export default function NutritionistProfileLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <NutritionistProfileSkeleton />
      </div>
    </div>
  );
}

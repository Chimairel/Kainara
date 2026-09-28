import NutritionistLibrarySkeleton from '@/features/nutritionist-library/NutritionistLibrarySkeleton';

export default function NutritionistLibraryLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <NutritionistLibrarySkeleton />
      </div>
    </div>
  );
}

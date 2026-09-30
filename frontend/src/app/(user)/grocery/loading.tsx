import GrocerySkeleton from '@/features/grocery/GrocerySkeleton';
import PortalPageHeader from '@/components/shared/PortalPageHeader';

export default function GroceryLoading() {
  return (
    <div className="portal-page select-none pb-32 text-brand-text">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <PortalPageHeader title="Groceries" description="A simple checklist for the ingredients in your meal plan." />
        <GrocerySkeleton />
      </div>
    </div>
  );
}

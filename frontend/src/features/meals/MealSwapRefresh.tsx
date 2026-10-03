import { LoaderCircle } from 'lucide-react';
import type { ReactNode } from 'react';

export default function MealSwapRefresh({
  refreshing,
  mealType,
  children,
}: {
  refreshing: boolean;
  mealType: string;
  children: ReactNode;
}) {
  if (!refreshing) return <>{children}</>;

  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-[20rem] items-center justify-center rounded-[24px] border border-brand-border/70 bg-brand-surface shadow-sm"
    >
      <LoaderCircle aria-hidden="true" className="h-8 w-8 animate-spin text-brand-green dark:text-brand-accent" />
      <span className="sr-only">Updating your {mealType.toLowerCase()} meal…</span>
    </div>
  );
}

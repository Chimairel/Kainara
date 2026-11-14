import type { ReactNode } from 'react';

/** Shared library presentation; data readers and permissions remain role-specific. */
export default function MealLibraryLayout({
  children,
  label = 'Meal library recipes',
  compact = false,
}: {
  children: ReactNode;
  label?: string;
  compact?: boolean;
}) {
  return (
    <section
      aria-label={label}
      className={compact ? 'grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-3' : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'}
    >
      {children}
    </section>
  );
}

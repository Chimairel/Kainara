import type { ReactNode } from 'react';

/** Shared library presentation; data readers and permissions remain role-specific. */
export default function MealLibraryLayout({
  children,
  label = 'Meal library recipes',
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <section aria-label={label} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {children}
    </section>
  );
}

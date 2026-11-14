export type PreparingMealSlot = { mealType: string; scheduledDate: string };

/** Shares the menu row footprint without inventing a recipe, image or nutrients. */
export function PreparingMealRow({ mealType }: Pick<PreparingMealSlot, 'mealType'>) {
  const label = mealType.charAt(0).toUpperCase() + mealType.slice(1).toLowerCase();
  return (
    <div
      role="status"
      aria-label={`${label} is being prepared`}
      className="relative flex min-h-40 items-center gap-3 rounded-2xl bg-brand-bgAlt p-3 sm:min-h-[176px] sm:rounded-3xl sm:px-5 sm:py-6 sm:pl-24"
    >
      <div
        aria-hidden="true"
        className="h-14 w-14 shrink-0 rounded-full bg-brand-border/60 motion-safe:animate-pulse sm:absolute sm:-left-10 sm:h-28 sm:w-28"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase text-brand-muted">{label}</p>
        <p className="mt-2 text-sm font-medium text-brand-text">Still preparing your meal…</p>
        <div aria-hidden="true" className="mt-4 space-y-2 motion-safe:animate-pulse">
          <div className="h-3 w-3/4 max-w-64 rounded-full bg-brand-border/60" />
          <div className="h-2 w-1/2 max-w-40 rounded-full bg-brand-border/60" />
        </div>
      </div>
    </div>
  );
}

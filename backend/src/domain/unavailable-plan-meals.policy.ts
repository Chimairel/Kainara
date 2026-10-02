type SavedMeal = {
  id: string;
  status: string;
  scheduledDate: Date;
  libraryMeal?: { status: string; safetyInvalidationReason?: string | null } | null;
  mealLogs?: readonly { status: string }[];
};

/** Hidden approvals are distinct from empty slots and pending review candidates. */
export function unavailablePlanMeals(rows: readonly SavedMeal[], clearedIds: ReadonlySet<string>, today: Date) {
  const unavailable = rows.filter(
    (row) =>
      row.status === 'APPROVED' &&
      !clearedIds.has(row.id) &&
      row.scheduledDate >= today &&
      !row.mealLogs?.some((log) => log.status === 'DONE' || log.status === 'SKIPPED')
  );
  return {
    unavailableMealCount: unavailable.length,
    retiredMealCount: unavailable.filter(
      (row) =>
        row.libraryMeal?.status === 'ARCHIVED' && row.libraryMeal.safetyInvalidationReason === 'SEEDED_FIXTURE_RETIRED'
    ).length,
  };
}

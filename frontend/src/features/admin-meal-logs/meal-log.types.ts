export type LogSnapshot = Record<string, unknown> & {
  mealName?: string;
  mealDate?: string;
  status?: string;
  source?: string;
  mealType?: string;
  calories?: number;
};
export type LogRow = {
  logId: string;
  memberName: string;
  memberId: string;
  ageGroup: string;
  membership: string;
  firstRecordedAt: string | null;
  lastActionAt: string | null;
  snapshot: LogSnapshot;
  deleted: boolean;
  synthetic?: boolean;
  contextVersion?: string;
};
export type LogEvent = {
  id: string;
  sequence: string;
  entityType: string;
  action: string;
  actorName: string;
  actorRole: string;
  occurredAt: string;
  reason: string | null;
  before: LogSnapshot | null;
  after: LogSnapshot | null;
};
export type LogDetail = {
  record: LogRow;
  items: LogSnapshot[];
  events: LogEvent[];
  total: number;
  page: number;
  totalPages: number;
};
export type PopularityRow = {
  key: string;
  name: string;
  eaten: number;
  skipped: number;
  members: number;
  repeatEaters: number;
  eatenPercentage: number | null;
};
export type FilterValues = {
  from: string;
  to: string;
  source: string;
  mealType: string;
  ageGroup: string;
  membership: string;
  member: string;
  status: string;
  recipeKey: string;
  includeTests: string;
  order: string;
};
export const membershipNames: Record<string, string> = {
  FREE: 'Free',
  FREE_HEALTH: 'Free Health trial',
  TRIAL_PENDING: 'Free Health · not started',
  LIFESTYLE: 'Lifestyle',
  HEALTH: 'Health',
  DISABLED: 'Membership disabled',
  UNKNOWN: 'Not recorded',
};
export function manilaDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
export function defaultFilters(): FilterValues {
  const now = new Date();
  return {
    from: manilaDate(new Date(now.getTime() - 29 * 86400000)),
    to: manilaDate(now),
    source: '',
    mealType: '',
    ageGroup: '',
    membership: '',
    member: '',
    status: '',
    recipeKey: '',
    includeTests: 'false',
    order: 'MOST_EATEN',
  };
}
export function logParams(filters: FilterValues, page: number, popularity = false) {
  return Object.fromEntries(
    Object.entries({ ...filters, page, limit: 20 }).filter(
      ([key, value]) =>
        value !== '' && (!popularity || !['member', 'status', 'recipeKey', 'includeTests'].includes(key))
    )
  );
}
export function displaySnapshot(value: LogSnapshot | null) {
  if (!value) return null;
  const labels: Record<string, string> = {
    calories: 'Calories (kcal)',
    provisionalCalories: 'Provisional calories (kcal)',
    calorieLow: 'Lower energy estimate (kcal)',
    calorieHigh: 'Upper energy estimate (kcal)',
    portionGrams: 'Portion (g)',
  };
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          ![
            'id',
            'mealLogId',
            'position',
            'foodItemId',
            'mealLibraryId',
            'recipeKey',
            'libraryMealId',
            'mealPlanId',
          ].includes(key)
      )
      .map(([key, item]) => [labels[key] ?? key, item])
  );
}

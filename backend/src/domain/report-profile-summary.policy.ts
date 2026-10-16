type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const title = (value: unknown) => typeof value === 'string' && value.trim() ? value.replace(/_/gu, ' ').toLowerCase().replace(/^./u, c => c.toUpperCase()) : 'Not recorded';
const measure = (value: unknown, unit: string) => typeof value === 'number' && Number.isFinite(value) ? `${value} ${unit}` : 'Not recorded';
const labels = (values: unknown) => Array.isArray(values) ? values.filter(value => typeof value === 'string' && value !== 'NONE') as string[] : [];

/** Saved version only. Absent historic fields are never filled from today's profile. */
export function reportProfileSummary(snapshot: unknown) {
  const saved = record(snapshot), p = record(saved.profile), times = record(saved.mealTimes);
  const entries = Array.isArray(saved.safetyEntries) ? saved.safetyEntries.map(record) : [];
  const restrictions = (domain: string, fallback?: unknown) => {
    const values = entries.filter(entry => entry.domain === domain).map(entry => String(entry.displayName ?? entry.canonicalCode ?? ''));
    const selected = values.length ? values : labels(fallback);
    return selected.length ? [...new Set(selected)].map(title).join(', ') : entries.length || Array.isArray(fallback) ? 'None declared' : 'Not recorded';
  };
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return [
    { label: 'Name', value: typeof saved.name === 'string' ? saved.name : 'Not recorded' },
    { label: 'Age', value: measure(p.age, 'years') }, { label: 'Biological sex', value: title(p.biologicalSex) },
    { label: 'Height', value: measure(p.heightCm, 'cm') }, { label: 'Current weight', value: measure(p.weightKg, 'kg') },
    { label: 'Target weight', value: measure(p.targetWeightKg, 'kg') }, { label: 'Goal', value: title(p.goal) },
    { label: 'Activity level', value: title(p.activityLevel) }, { label: 'Dietary preference', value: title(p.dietaryPreference) },
    { label: 'Rice preference', value: title(p.ricePreference) }, { label: 'Food culture', value: title(p.foodCulture) },
    { label: 'Conditions', value: restrictions('CONDITION', saved.conditions) },
    { label: 'Allergies', value: restrictions('ALLERGY', saved.allergens) },
    { label: 'Intolerances', value: restrictions('INTOLERANCE') },
    { label: 'Avoided foods', value: restrictions('AVOIDED_INGREDIENT') },
    { label: 'Other conditions', value: !('otherConditions' in saved) ? 'Not recorded' : typeof saved.otherConditions === 'string' && saved.otherConditions.trim() ? saved.otherConditions : 'None declared' },
    { label: 'Other food restrictions', value: !('otherAllergies' in saved) ? 'Not recorded' : typeof saved.otherAllergies === 'string' && saved.otherAllergies.trim() ? saved.otherAllergies : 'None declared' },
    { label: 'Meal times', value: ['breakfastTime', 'lunchTime', 'dinnerTime'].some(key => times[key]) ?
      `Breakfast ${times.breakfastTime ?? 'not recorded'} · Lunch ${times.lunchTime ?? 'not recorded'} · Dinner ${times.dinnerTime ?? 'not recorded'} (${times.timeZone ?? 'timezone not recorded'})` : 'Not recorded' },
    { label: 'Shopping day', value: typeof p.shoppingDayOfWeek === 'number' ? days[p.shoppingDayOfWeek] ?? 'Not recorded' : title(p.shoppingDayGroup) },
  ];
}

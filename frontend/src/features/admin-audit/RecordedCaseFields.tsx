import { recordFieldClass, recordSectionClass } from '@/components/shared/RecordPaper';

const hiddenFields = new Set([
  'id',
  'userId',
  'nutritionistProfileId',
  'claimedByNutritionistId',
  'sha256',
  'documentSha256',
]);
const labels: Record<string, string> = {
  userProfile: 'Member details',
  biologicalSex: 'Biological sex',
  heightCm: 'Height (cm)',
  weightKg: 'Weight (kg)',
  targetWeightKg: 'Target weight (kg)',
  dailyCalorieTarget: 'Daily energy target (kcal)',
  proteinG: 'Protein (g)',
  carbsG: 'Carbohydrates (g)',
  fatG: 'Fat (g)',
  sodiumMg: 'Sodium (mg)',
  healthConditions: 'Health conditions',
  conditionAssessments: 'Recorded condition relevance assessments',
  mealPlanningAssessment: 'Current meal-planning relevance assessment',
  reviewedDietaryAndTreatmentEffects: 'Dietary and treatment effects reviewed',
  reviewedFoodborneIllnessRisk: 'Foodborne illness risk reviewed',
  allergies: 'Food allergies',
  safetyProfileEntries: 'Safety declarations',
  clinicalContextResponses: 'Health details',
  evidenceSnapshot: 'Evidence recorded for this decision',
  profileSnapshot: 'Profile recorded for this decision',
  actorSnapshot: 'Recorded reviewer',
  prcLicenseNumber: 'PRC license number',
  planningReportVersion: 'Planning report version',
  firstReportAcknowledgedAt: 'First report acknowledged',
  tosAccepted: 'Terms accepted',
};
export function recordLabel(key: string) {
  if (labels[key]) return labels[key];
  const text = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
export function recordValue(value: unknown): string {
  if (value == null || value === '') return 'Not recorded';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value === 'NUTRITIONIST') return 'RND';
  if (value === 'ADMIN') return 'Administrator';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value))) {
    return (
      new Date(value).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }) +
      ' · Philippine time'
    );
  }
  if (typeof value === 'string' && /^[A-Z][A-Z0-9_]+$/.test(value)) return recordLabel(value);
  return String(value);
}
export function recordedObject(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Render saved data without filling absent historical fields from the live profile. */
export default function RecordedCaseFields({ value }: { value: unknown }) {
  if (Array.isArray(value)) {
    if (!value.length) return <p className="text-sm text-brand-muted">None recorded</p>;
    if (value.every((item) => item == null || typeof item !== 'object')) {
      return (
        <ul className="flex flex-wrap gap-2">
          {value.map((item, index) => (
            <li key={index} className={`${recordFieldClass} text-sm`}>
              {recordValue(item)}
            </li>
          ))}
        </ul>
      );
    }
    return (
      <ol className="space-y-3">
        {value.map((item, index) => (
          <li key={index} className={recordSectionClass}>
            <p className="text-xs font-bold text-brand-muted">Record {index + 1}</p>
            <RecordedCaseFields value={item} />
          </li>
        ))}
      </ol>
    );
  }
  const object = recordedObject(value);
  if (!object) return <p className="whitespace-pre-wrap text-sm leading-relaxed">{recordValue(value)}</p>;
  const entries = Object.entries(object).filter(([key]) => !hiddenFields.has(key));
  const fields = entries.filter(([, item]) => item == null || typeof item !== 'object');
  const groups = entries.filter(([, item]) => item != null && typeof item === 'object');
  if (!entries.length) return <p className="text-sm text-brand-muted">No details recorded</p>;
  return (
    <div className="min-w-0 space-y-4">
      {!!fields.length && (
        <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {fields.map(([key, item]) => (
            <div key={key} className={`${recordFieldClass} min-w-0`}>
              <dt className="text-xs font-semibold text-brand-muted">{recordLabel(key)}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-relaxed">{recordValue(item)}</dd>
            </div>
          ))}
        </dl>
      )}
      {groups.map(([key, item]) => (
        <section key={key} className={recordSectionClass}>
          <h4 className="border-b border-brand-border/70 pb-3 font-display text-sm font-bold">{recordLabel(key)}</h4>
          <RecordedCaseFields value={item} />
        </section>
      ))}
    </div>
  );
}

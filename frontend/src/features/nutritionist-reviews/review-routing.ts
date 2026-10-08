export const EXPERTISE_OPTIONS = [
  { code: 'DIABETES', label: 'Diabetes nutrition' },
  { code: 'HYPERTENSION', label: 'Hypertension nutrition' },
  { code: 'KIDNEY_DISEASE', label: 'Renal nutrition' },
  { code: 'HEART_CONDITION', label: 'Heart health nutrition' },
  { code: 'PREGNANT', label: 'Maternal nutrition' },
] as const;
export type ReviewRouting = { stage: string; opensAt: string | null; reason: string };
export function expertiseLabel(code: string) {
  return EXPERTISE_OPTIONS.find((item) => item.code === code)?.label ?? code;
}

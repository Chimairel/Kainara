export const reviewConditionLabels: Record<string, string> = {
  DIABETES: 'Diabetes',
  HYPERTENSION: 'Hypertension',
  KIDNEY_DISEASE: 'Kidney disease',
  HEART_CONDITION: 'Heart condition',
  PREGNANT: 'Pregnancy',
};

export function recordedConditionsLabel(codes: string[] | null | undefined) {
  if (!Array.isArray(codes)) return 'Not recorded';
  if (!codes.length) return 'None declared';
  return codes.map(code => reviewConditionLabels[code]).filter(Boolean).join(', ') || 'Not recorded';
}

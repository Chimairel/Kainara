'use client';

import NutritionGuidancePaper from '@/features/reports/NutritionGuidancePaper';
import PatientNutritionLimits from '../PatientNutritionLimits';
import type { useCaseReviewWorkspaceModel } from './useCaseReviewWorkspaceModel';

type Model = Extract<ReturnType<typeof useCaseReviewWorkspaceModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'detailData'>; paper?: boolean };

/** The saved guidance already contains the member's planning profile and calculations. */
export default function CaseProfileSection({ model, paper = false }: SectionProps) {
  const detail = model.detailData;
  if (!detail) return null;
  return <section aria-label="Member nutrition guidance" className={paper ? '' : 'rounded-2xl bg-brand-surface p-5'}>
    {detail.user.nutritionGuidance ? <NutritionGuidancePaper
      report={detail.user.nutritionGuidance} presentation="inline"
      profile={{ name: detail.user.name, goal: detail.user.goal,
        dailyCalorieTarget: detail.user.dailyCalorieTarget,
        conditions: detail.user.conditions, foodRestrictions: detail.user.allergies }} />
      : <p className="text-sm text-brand-muted">No saved nutrition guidance is recorded for this review.</p>}
    {detail.claimStatus?.claimedByMe && <PatientNutritionLimits key={detail.mealPlan.id} mealId={detail.mealPlan.id} conditions={detail.user.conditions} />}
  </section>;
}

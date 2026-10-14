import type { DetailData } from './review-types';
import type { ReviewCanvasLayout } from './ReviewCanvas';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** Historical fallback reads saved inputs only; missing fields never come from today's profile. */
export function savedReviewPresentation(value: unknown) {
  const evidence = object(value);
  const canvas = object(evidence.savedCanvas);
  const saved = object(canvas.detail);
  const full = saved.mealPlan && saved.user && Array.isArray(saved.ingredients);
  const context = object(evidence.reviewContext), profile = object(context.profile), clinical = object(context.clinical);
  const recorded = object(evidence.recordedProfile);
  const meal = object(evidence.effective ?? evidence.original ?? context.meal);
  const detail = full ? structuredClone(saved) : {
    mealPlan: { ...object(context.meal), ...meal, id: object(context.meal).id ?? 'saved', scheduledDate: object(context.meal).scheduledDate,
      mealType: object(context.meal).mealType ?? 'Not recorded', mealName: meal.mealName ?? evidence.mealName ?? 'Name not recorded' },
    user: { name: profile.name ?? recorded.name ?? 'Name not recorded', age: profile.age ?? recorded.age ?? null,
      sex: profile.biologicalSex ?? recorded.biologicalSex ?? 'Not recorded', goal: profile.goal ?? 'Not recorded',
      dailyCalorieTarget: profile.dailyCalorieTarget ?? null, dietaryPreference: profile.dietaryPreference ?? 'Not recorded',
      ricePreference: profile.ricePreference ?? 'Not recorded', conditions: Array.isArray(clinical.conditions ?? recorded.conditions) ? clinical.conditions ?? recorded.conditions : [],
      allergies: Array.isArray(clinical.allergies ?? recorded.allergens) ? clinical.allergies ?? recorded.allergens : [],
      conditionsRecorded: Array.isArray(clinical.conditions ?? recorded.conditions),
      allergiesRecorded: Array.isArray(clinical.allergies ?? recorded.allergens) },
    ingredients: (Array.isArray(meal.ingredients) ? meal.ingredients : []).map((value: unknown) => { const item = object(value); return {
      name: item.ingredientName ?? item.name, quantity: item.quantity ?? null, unit: item.unit ?? null,
      source: item.dataSource ?? item.source ?? 'NOT_RECORDED', compositionFoodName: object(item.foodItem).name ?? null,
    }; }),
    clinicalEvidence: { healthDetails: Array.isArray(clinical.healthDetails) ? clinical.healthDetails : [], requirements: (Array.isArray(clinical.healthDetails) ? clinical.healthDetails : []).map((item: unknown) => ({ area: object(item).area, state: 'RECORDED', message: 'Saved health details.' })),
      documents: Array.isArray(context.clinicalDocuments) ? context.clinicalDocuments : [] },
    warnings: [], highRiskReviewRequired: false, clarifications: evidence.clarifications,
  };
  detail.claimStatus = { claimedByMe: false, claimedByOther: false, claimedByName: null };
  const layout = object(canvas.layout), view = object(layout.view);
  const usableLayout = layout.version === 1 && Array.isArray(layout.sheets) && layout.sheets.length <= 50 &&
    layout.sheets.every((value: unknown) => { const sheet = object(value); return typeof sheet.title === 'string' && Number.isFinite(sheet.x) && Number.isFinite(sheet.y); }) &&
    Number.isFinite(view.x) && Number.isFinite(view.y) && Number.isFinite(view.scale) && typeof view.scale === 'number' && view.scale >= 0.1 && view.scale <= 2;
  return { detail: detail as unknown as DetailData, layout: usableLayout ? layout as unknown as ReviewCanvasLayout : null, exact: Boolean(full && usableLayout),
    related: canvas.related as { view: import('./RelatedConditionReviews').RelatedReviewView; result: import('./RelatedConditionReviews').ReviewPage } | undefined };
}

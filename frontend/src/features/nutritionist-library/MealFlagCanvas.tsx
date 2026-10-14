'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import RndQueueDocument, { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
import BaseMealEvidenceSheets from '@/features/nutritionist-reviews/BaseMealEvidenceSheets';
import FlagReasonFields, { emptyFlagReason, validFlagReason, type FlagReason } from '@/features/nutritionist-reviews/FlagReasonFields';
import type { LibraryMeal } from './useNutritionistLibrary';

export default function MealFlagCanvas({ meal, value, onChange, onClose, onSubmit, busy, error }: {
  meal: LibraryMeal; value: FlagReason; onChange: (value: FlagReason) => void;
  onClose: () => void; onSubmit: () => void; busy: boolean; error?: string | null;
}) {
  const [writing, setWriting] = useState(true);
  const [request, setRequest] = useState(1);
  const cancel = () => { if (!busy) { setWriting(false); onChange({ ...emptyFlagReason }); } };
  return <RndQueueDocument stackOnMobile hideDecisionDock title={`Meal verification · ${meal.mealName}`} contentKey={meal.id}
    expanded onExpandedChange={open => { if (!open && !busy) onClose(); }} onBack={() => { if (!busy) onClose(); }}
    focusSheet={writing ? { title: 'Flag meal reasons', request } : undefined}
    actions={<Button variant={writing ? 'secondary' : 'danger'} size="sm" disabled={busy} onClick={() => {
      if (writing) cancel(); else { setWriting(true); setRequest(value => value + 1); }
    }}>{writing ? 'Cancel' : 'Flag meal'}</Button>}>
    {BaseMealEvidenceSheets({ selected: { kind: 'LIBRARY_MEAL', id: meal.id, revisionKey: '', name: meal.mealName,
      description: meal.description ?? null, mealType: meal.mealType, source: meal.sourceRawRecipeCandidate?.sourceName ?? 'Recorded recipe', status: meal.status === 'APPROVED' ? 'VERIFIED' : meal.status,
      calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG, ingredients: meal.ingredients,
      riceRole: meal.riceRole,
      imageUrl: meal.image?.url ?? null, claimedByMe: false, claimedByOther: false }, image: meal.image ?? null })}
    {writing && <ReviewDocumentPage page={3} title="Flag meal reasons" subtitle="Draft · not submitted">
      <p className="mb-6 text-sm">Submitting withholds this meal and its serving variants for independent review.</p>
      {error && <p role="alert" className="mb-4 text-status-error-text">{error}</p>}
      <form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="space-y-6">
        <FlagReasonFields value={value} onChange={onChange} busy={busy} />
        <Button type="submit" variant="danger" isLoading={busy} disabled={busy || !validFlagReason(value)}>Flag and withhold meal</Button>
      </form>
    </ReviewDocumentPage>}
  </RndQueueDocument>;
}

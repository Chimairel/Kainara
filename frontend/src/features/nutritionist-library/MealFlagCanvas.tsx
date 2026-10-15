'use client';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import RndQueueDocument, { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';
import BaseMealEvidenceSheets from '@/features/nutritionist-reviews/BaseMealEvidenceSheets';
import FlagReasonFields, { validFlagReason } from '@/features/nutritionist-reviews/FlagReasonFields';
import type { useFlagDraft } from '@/features/nutritionist-reviews/useFlagDraft';
import FlagDraftNotice from '@/features/nutritionist-reviews/FlagDraftNotice';
import type { LibraryMeal } from './useNutritionistLibrary';

export default function MealFlagCanvas({ meal, draft, onClose, onSubmit, busy, error }: {
  meal: LibraryMeal; draft: ReturnType<typeof useFlagDraft>;
  onClose: () => void; onSubmit: () => void; busy: boolean; error?: string | null;
}) {
  const { writing, notes: value, setNotes: onChange } = draft;
  const [request, setRequest] = useState(0);
  const cancel = () => { if (!busy) void draft.cancel(); };
  return <RndQueueDocument stackOnMobile hideDecisionDock title={`Meal verification · ${meal.mealName}`} contentKey={meal.id}
    expanded onExpandedChange={open => { if (!open && !busy) { if (writing) void draft.save().then(ok => { if (ok) onClose(); }); else onClose(); } }} onBack={() => { if (!busy) { if (writing) void draft.save().then(ok => { if (ok) onClose(); }); else onClose(); } }}
    focusSheet={writing ? { title: 'Flag meal reasons', request } : undefined}
    actions={<div className="flex max-w-sm flex-col items-end gap-1"><Button variant={writing ? 'secondary' : 'danger'} size="sm" disabled={busy || draft.busy || (!writing && !draft.ready)} onClick={() => {
      if (writing) cancel(); else void draft.begin().then(ok => { if (ok) setRequest(value => value + 1); });
    }}>{writing ? 'Cancel' : draft.status?.blocked ? 'Flag in progress' : 'Flag meal'}</Button><FlagDraftNotice draft={draft} compact /></div>}>
    {BaseMealEvidenceSheets({ selected: { kind: 'LIBRARY_MEAL', id: meal.id, revisionKey: '', name: meal.mealName,
      description: meal.description ?? null, mealType: meal.mealType, source: meal.sourceRawRecipeCandidate?.sourceName ?? 'Recorded recipe', status: meal.status === 'APPROVED' ? 'VERIFIED' : meal.status,
      calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG, ingredients: meal.ingredients,
      riceRole: meal.riceRole,
      imageUrl: meal.image?.url ?? null, claimedByMe: false, claimedByOther: false }, image: meal.image ?? null })}
    {writing && <ReviewDocumentPage page={3} title="Flag meal reasons" subtitle="Draft · not submitted">
      <p className="mb-6 text-sm">Submitting withholds this meal and its serving variants for independent review.</p>
      <FlagDraftNotice draft={draft} />
      {error && <p role="alert" className="mb-4 text-status-error-text">{error}</p>}
      <form onSubmit={event => { event.preventDefault(); onSubmit(); }} className="space-y-6">
        <FlagReasonFields value={value} onChange={onChange} busy={busy} />
        <Button type="submit" variant="danger" isLoading={busy} disabled={busy || draft.busy || Boolean(draft.error) || !validFlagReason(value)}>Flag and withhold meal</Button>
      </form>
    </ReviewDocumentPage>}
  </RndQueueDocument>;
}

'use client';

import Button from '@/components/ui/Button';
import { Check, Edit, Plus, RefreshCw, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';

import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';

type Props = { review: ReturnType<typeof useNutritionistReviews> };

export default function CaseReplacementForm({ review }: Props) {
  const {
    selectedMealId,
    actionLoading,
    rejectNote,
    setRejectNote,
    showRejectForm,
    setShowRejectForm,
    candidateMeal,
    isGeneratingCandidate,
    isEditingCandidate,
    setIsEditingCandidate,
    handleGenerateCandidate,
    handleReplaceAndApprove,
    updateCandidateField,
    addCandidateIngredient,
    removeCandidateIngredient,
    updateCandidateIngredient,
    resetCandidate,
    handleReject,
  } = review;
  return (
    <>
      {showRejectForm && (
        <div className="p-5 border border-red-500/25 bg-red-950/10 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-red-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" /> Clinical Rejection & In-Flight Replacement
            </h4>
            {candidateMeal && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold text-emerald-400">
                <Sparkles className="w-3 h-3 text-emerald-400" /> AI Candidate Ready
              </span>
            )}
          </div>

          <p className="text-xs text-brand-muted leading-relaxed">
            Specify why this dish is contraindicated for the patient. You can immediately generate an alternative dish
            tailored to avoid this problem and verify it in one step, so the patient never receives an unverified
            pending meal.
          </p>

          <div>
            <label className="block text-[10px] font-extrabold uppercase tracking-wider text-brand-muted mb-1.5">
              Rejection Reason & Negative Constraint (Required)
            </label>
            <textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="e.g., Too high sodium for hypertension; bagoong contraindicated; high purine for hyperuricemia..."
              rows={2}
              disabled={Boolean(candidateMeal)}
              className="bg-brand-bg text-brand-text border border-brand-border rounded-xl px-4 py-2.5 text-xs w-full focus:outline-none focus:border-red-500 resize-none disabled:opacity-75"
            />
          </div>

          {!candidateMeal ? (
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <Button
                variant="primary"
                onClick={handleGenerateCandidate}
                isLoading={isGeneratingCandidate}
                disabled={!rejectNote.trim() || isGeneratingCandidate}
                className="w-full sm:w-auto text-xs px-6 py-2.5 bg-brand-green text-brand-bg hover:bg-brand-green/90 font-bold flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate Compliant Replacement ⚡</span>
              </Button>
              <Button
                variant="ghost"
                onClick={() => void handleReject()}
                isLoading={actionLoading === selectedMealId}
                disabled={!rejectNote.trim() || isGeneratingCandidate}
                className="w-full sm:w-auto text-xs px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-500/10 dark:hover:bg-red-950/20 border border-red-500/25 font-semibold"
                title="Reject directly without an in-flight replacement"
              >
                Reject Without Replacement
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectNote('');
                  resetCandidate();
                }}
                disabled={isGeneratingCandidate}
                className="w-full sm:w-auto text-xs px-4 py-2"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-green/30 bg-brand-bg/70 p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-brand-border/60 pb-2.5">
                <div className="min-w-0 flex-1 mr-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-brand-green">
                    Proposed Replacement Dish
                  </span>
                  <div className="mt-0.5">
                    {isEditingCandidate ? (
                      <input
                        type="text"
                        value={candidateMeal.mealName}
                        onChange={(e) => updateCandidateField('mealName', e.target.value)}
                        className="bg-brand-bgAlt border border-brand-border rounded-lg px-2.5 py-1 text-sm font-bold text-brand-text w-full focus:outline-none focus:border-brand-green"
                      />
                    ) : (
                      <h3 className="font-display text-base font-extrabold text-brand-text">
                        {candidateMeal.mealName}
                      </h3>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => setIsEditingCandidate(!isEditingCandidate)}
                  className="text-[11px] font-semibold text-brand-muted hover:text-brand-text py-1 px-2.5 h-auto shrink-0"
                >
                  <Edit className="w-3 h-3 mr-1" />
                  {isEditingCandidate ? 'Done' : 'Tweak'}
                </Button>
              </div>

              {isEditingCandidate ? (
                <textarea
                  value={candidateMeal.description}
                  onChange={(e) => updateCandidateField('description', e.target.value)}
                  rows={2}
                  placeholder="Description..."
                  className="bg-brand-bgAlt border border-brand-border rounded-lg px-2.5 py-1.5 text-xs text-brand-text w-full focus:outline-none focus:border-brand-green resize-none"
                />
              ) : (
                <p className="text-xs text-brand-muted leading-relaxed">
                  {candidateMeal.description || 'AI-generated clinical replacement meal.'}
                </p>
              )}

              {/* Macro distribution */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2">
                  <span className="block text-xs font-black font-display text-brand-text">
                    {Math.round(candidateMeal.calories)} kcal
                  </span>
                  <span className="block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">
                    Energy
                  </span>
                </div>
                <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2">
                  <span className="block text-xs font-black font-display text-brand-text">
                    {Math.round(candidateMeal.proteinG)}g
                  </span>
                  <span className="block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">
                    Protein
                  </span>
                </div>
                <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2">
                  <span className="block text-xs font-black font-display text-brand-text">
                    {Math.round(candidateMeal.carbsG)}g
                  </span>
                  <span className="block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">
                    Carbs
                  </span>
                </div>
                <div className="rounded-xl border border-brand-border/60 bg-brand-surface p-2">
                  <span className="block text-xs font-black font-display text-brand-text">
                    {Math.round(candidateMeal.fatG)}g
                  </span>
                  <span className="block text-[8px] font-extrabold uppercase tracking-wider text-brand-muted">Fat</span>
                </div>
              </div>

              {/* Proposed Ingredients */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                    Ingredients ({candidateMeal.ingredients.length})
                  </span>
                  {isEditingCandidate && (
                    <button
                      type="button"
                      onClick={addCandidateIngredient}
                      className="text-[10px] text-brand-green font-bold flex items-center gap-0.5 hover:underline"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  )}
                </div>
                {isEditingCandidate ? (
                  <div className="space-y-1.5">
                    {candidateMeal.ingredients.map((ing, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={ing.name}
                          onChange={(e) => updateCandidateIngredient(idx, e.target.value)}
                          className="bg-brand-bgAlt border border-brand-border rounded-lg px-2 py-1 text-xs text-brand-text flex-1 focus:outline-none focus:border-brand-green"
                        />
                        <button
                          type="button"
                          onClick={() => removeCandidateIngredient(idx)}
                          className="text-red-400 p-1 hover:bg-red-500/10 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {candidateMeal.ingredients.map((ing, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg border border-brand-border/70 bg-brand-surface px-2.5 py-1 text-[11px] font-semibold text-brand-text"
                      >
                        {ing.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Final Decision Action Row */}
              <div className="pt-2 border-t border-brand-border/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  variant="primary"
                  onClick={handleReplaceAndApprove}
                  isLoading={actionLoading === selectedMealId}
                  className="text-xs px-6 py-2.5 font-bold flex-1 flex items-center justify-center gap-1.5 bg-brand-green text-brand-bg hover:bg-brand-green/90"
                >
                  <Check className="w-4 h-4" />
                  <span>Send replacement for meal verification</span>
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleGenerateCandidate}
                  isLoading={isGeneratingCandidate}
                  className="text-xs px-4 py-2 text-brand-muted hover:text-brand-text"
                  title="Regenerate another suggestion"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Re-roll
                </Button>
                <Button variant="ghost" onClick={resetCandidate} className="text-xs px-3 py-2 text-brand-muted">
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

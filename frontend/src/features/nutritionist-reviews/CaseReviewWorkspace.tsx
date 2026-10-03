'use client';

import CaseReplacementForm from './CaseReplacementForm';

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Avatar from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import MealImage from '@/components/user/MealImage';
import { ReviewDetailSkeleton } from '@/features/nutritionist-reviews/NutritionistReviewsSkeleton';
import type { PublicMealImage } from '@/types';
import { AlertTriangle, Check, Flame, Info, Plus, ShieldAlert, ShieldCheck, Trash2, X } from 'lucide-react';

import { toast } from '@/components/ui/Sonner';
import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';
import IngredientEvidenceList from '@/features/nutritionist-reviews/IngredientEvidenceList';
import { useNutritionistReviews } from '@/features/nutritionist-reviews/useNutritionistReviews';
import api from '@/lib/axios';

import type { Dispatch, ReactNode, SetStateAction } from 'react';
import CaseReviewQueue from './CaseReviewQueue';

type Props = {
  review: ReturnType<typeof useNutritionistReviews>;
  caseFilter: string;
  expanded: boolean;
  setExpanded: Dispatch<SetStateAction<boolean>>;
  navigation: ReactNode;
  caseFilters: ReactNode;
};

export default function CaseReviewWorkspace({
  review,
  caseFilter,
  expanded,
  setExpanded,
  navigation,
  caseFilters,
}: Props) {
  const {
    queue,
    selectedMealId,
    setSelectedMealId,
    detailLoading,
    detailData,
    actionLoading,
    showRejectForm,
    setShowRejectForm,
    generalNote,
    setGeneralNote,
    errorMsg,
    isEditing,
    setIsEditing,
    editForm,
    setEditForm,
    handleClaimMeal,
    handleReleaseMeal,
    handleApprove,
    addIngredientField,
    removeIngredientField,
    updateIngredientField,
  } = review;
  const selectedQueueMeal = queue.find((m) => m.id === selectedMealId);
  const activeClaimStatus = detailData?.claimStatus ?? selectedQueueMeal?.claimStatus;

  const claimHeader = selectedMealId ? (
    activeClaimStatus?.claimedByMe ? (
      <div className="flex items-center gap-2 rounded-xl border border-brand-green/35 bg-brand-surface/95 px-3 py-1.5 text-xs text-brand-green shadow-md backdrop-blur-md">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-green" />
        <span className="font-semibold text-xs text-brand-text">
          Claimed until{' '}
          {activeClaimStatus.claimExpiresAt
            ? new Date(activeClaimStatus.claimExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '30m'}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleReleaseMeal}
          isLoading={actionLoading === selectedMealId}
          disabled={Boolean(actionLoading)}
          className="ml-1 text-[11px] h-7 px-2.5 rounded-lg border-brand-green/30 hover:border-brand-green/50"
        >
          Release claim
        </Button>
      </div>
    ) : activeClaimStatus?.claimedByOther ? (
      <span className="rounded-xl border border-[#a64600]/30 bg-[#8c3b00] px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-md">
        Being reviewed by another RND
      </span>
    ) : activeClaimStatus?.coolingDownForMe ? (
      <span className="rounded-xl border border-[#a64600]/30 bg-[#8c3b00] px-3 py-1.5 text-xs font-bold text-white shadow-sm backdrop-blur-md">
        Claim cooling down
      </span>
    ) : (
      <Button
        size="sm"
        onClick={handleClaimMeal}
        isLoading={actionLoading === selectedMealId || (detailLoading && !activeClaimStatus)}
        disabled={Boolean(actionLoading)}
        className="rounded-xl shadow-md text-xs font-bold px-3.5 py-2"
      >
        <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
        Claim review
      </Button>
    )
  ) : null;

  return (
    <div className="portal-page space-y-5 pb-20 text-brand-text">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <PortalPageHeader
          icon={ShieldCheck}
          eyebrow="Clinical workspace"
          title="Reviews"
          description="Audit AI-generated meal plans, approve health profiles, and verify base recipes."
        />
        {navigation}
        {caseFilters}
        <div className="flex md:h-[calc(100vh-270px)] md:min-h-[640px] flex-col overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface text-left shadow-sm md:flex-row">
          {/* Master Queue List Panel */}
          <CaseReviewQueue review={review} caseFilter={caseFilter} expanded={expanded} />

          {/* Details View Panel */}
          <ExpandableCasePanel
            expanded={expanded}
            onExpandedChange={setExpanded}
            canExpand={selectedMealId !== null}
            headerLeft={claimHeader}
            onBack={() => setSelectedMealId(null)}
            className={`${selectedMealId ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent`}
          >
            {selectedMealId === null ? (
              <div className="space-y-6 py-2">
                <div className="rounded-3xl border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-8 shadow-sm space-y-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent/15 text-brand-accent">
                    <ShieldCheck className="h-6 w-6 stroke-[2.2]" />
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">
                      A clear path to every review
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                      Select a meal to inspect the person’s health profile and the meal’s evidence side by side. The
                      review lock begins only when you press Claim review.
                    </p>
                  </div>
                  <div className="grid gap-3 pt-2">
                    {[
                      {
                        step: '01',
                        title: 'Inspect an available meal',
                        desc: 'Preview the patient’s clinical conditions, allergen profile, and meal candidate evidence.',
                      },
                      {
                        step: '02',
                        title: 'Claim when ready to decide',
                        desc: 'Secure a 30-minute exclusive review lock when you are ready to evaluate.',
                      },
                      {
                        step: '03',
                        title: 'Decide and record your review notes',
                        desc: 'Approve, edit portions/ingredients, or regenerate candidates with clinical notes.',
                      },
                    ].map((item) => (
                      <div
                        key={item.step}
                        className="flex items-start gap-3.5 rounded-2xl border border-brand-border/60 bg-brand-bgAlt/50 p-4 transition-colors hover:border-brand-accent/30"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-accent/15 font-mono text-xs font-black text-brand-accent">
                          {item.step}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-display text-sm font-bold text-brand-text">{item.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : detailLoading ? (
              <div className="flex-1">
                <ReviewDetailSkeleton />
              </div>
            ) : errorMsg && !detailData ? (
              <div className="p-6 bg-red-950/20 border border-red-500/20 rounded-xl space-y-4 max-w-lg mx-auto mt-12 text-center">
                <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-brand-text">Access Blocked</h3>
                  <p className="text-xs text-brand-muted">{errorMsg}</p>
                </div>
                <Button variant="secondary" onClick={() => setSelectedMealId(null)} className="text-xs px-6">
                  Back to Queue
                </Button>
              </div>
            ) : detailData ? (
              <div className="space-y-6">
                {errorMsg && (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-500/30 bg-red-950/20 p-3 text-xs text-red-400"
                  >
                    {errorMsg}
                  </div>
                )}
                {detailData.claimStatus.claimedByMe && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-brand-green/20 bg-brand-green/10 p-3 text-xs text-brand-green">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>
                      30-minute exclusive review lock active. Submit before expiry to prevent automatic release and
                      cooldown.
                    </span>
                  </div>
                )}
                {detailData.mealPlan.requiresSafetyRevalidation && (
                  <div
                    role="status"
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-brand-text"
                  >
                    <strong>Profile or evidence changed.</strong> Check the current diet, allergies, conditions and
                    portion target below. Previous automated triage is not current.
                  </div>
                )}
                {detailData.highRiskReviewRequired && (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {detailData.requiresIndependentSecondReview
                      ? 'This meal has one approval. You are performing the required independent second review.'
                      : 'This profile requires two independent nutritionist approvals before the meal becomes actionable.'}
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Split Panel Body */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  {/* Left Panel: User Profile */}
                  <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
                    <div className="flex items-center gap-3.5 border-b border-brand-border pb-3">
                      <Avatar name={detailData.user.name} size="lg" />
                      <div className="min-w-0 flex-1">
                        <h2 className="text-[10px] font-bold text-brand-muted uppercase tracking-wider">
                          User Health Profile
                        </h2>
                        <h3 className="truncate text-base font-extrabold text-brand-text mt-0.5">
                          {detailData.user.name}
                        </h3>
                        <p className="text-xs text-brand-muted">
                          {detailData.user.age} yrs • {detailData.user.sex}
                        </p>
                      </div>
                    </div>

                    {/* Health Conditions */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-brand-muted">Conditions</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {detailData.user.conditions.length === 0 ? (
                          <span className="text-xs text-brand-muted italic">None declared</span>
                        ) : (
                          detailData.user.conditions.map((hc, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 bg-red-950/30 border border-red-800/30 text-red-400 text-[10px] rounded-lg font-bold"
                            >
                              {hc}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Allergies */}
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-bold text-brand-muted">Allergies</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {detailData.user.allergies.length === 0 ? (
                          <span className="text-xs text-brand-muted italic">None declared</span>
                        ) : (
                          detailData.user.allergies.map((alg, i) => (
                            <span
                              key={i}
                              className="px-2.5 py-1 bg-red-950/30 border border-red-800/30 text-red-400 text-[10px] rounded-lg font-bold"
                            >
                              {alg}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {detailData.user.safetyEntries && detailData.user.safetyEntries.length > 0 && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-bold text-brand-muted">Complete structured restrictions</h4>
                        <div className="space-y-1.5">
                          {detailData.user.safetyEntries.map((entry, index) => (
                            <div
                              key={`${entry.domain}-${entry.label}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-lg border border-brand-border/60 bg-brand-bg/50 px-2.5 py-2 text-[10px]"
                            >
                              <span className="font-bold text-brand-text">{entry.label}</span>
                              <span className="text-right font-mono uppercase text-brand-muted">
                                {entry.domain.replaceAll('_', ' ')} · {entry.supportState.replaceAll('_', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detailData.clinicalEvidence && detailData.clinicalEvidence.requirements.length > 0 && (
                      <div className="space-y-2 border-t border-brand-border pt-3 text-xs">
                        <h4 className="font-bold text-brand-text">Health details reviewed for the profile</h4>
                        {detailData.clinicalEvidence.healthDetails?.map((item) => (
                          <div key={item.area} className="rounded-lg border border-brand-border p-2">
                            <p className="font-bold">{item.area.replaceAll('_', ' ')} · user-provided</p>
                            {['conditionDetails', 'medications', 'dietaryAdvice', 'recentSymptoms', 'measurements'].map(
                              (field) =>
                                typeof item.responses[field] === 'string' && item.responses[field] ? (
                                  <p key={field} className="mt-1 whitespace-pre-wrap">
                                    <strong>{field.replace(/([A-Z])/g, ' $1')}: </strong>
                                    {String(item.responses[field])}
                                  </p>
                                ) : null
                            )}
                          </div>
                        ))}
                        {detailData.clinicalEvidence.requirements.map((item) => (
                          <p key={item.area} className={item.state === 'READY' ? 'text-brand-green' : 'text-amber-500'}>
                            {item.area.replaceAll('_', ' ')}: {item.message}
                          </p>
                        ))}
                        {detailData.clinicalEvidence.documents.map((item) => (
                          <div key={item.id} className="rounded-lg border border-brand-border p-2">
                            <p>
                              {item.area.replaceAll('_', ' ')} · {item.documentType.replaceAll('_', ' ')}
                              {item.validUntil
                                ? ` · valid until ${new Date(item.validUntil).toLocaleDateString()}`
                                : ''}
                            </p>
                            {item.facts.map((fact, index) => (
                              <p key={`${fact.code}-${index}`} className="text-brand-muted">
                                {fact.code.replaceAll('_', ' ')}: {fact.valueText ?? fact.valueNumber} {fact.unit ?? ''}
                              </p>
                            ))}
                            {detailData.claimStatus.claimedByMe && (
                              <button
                                type="button"
                                className="mt-1 font-semibold text-brand-green underline"
                                onClick={async () => {
                                  try {
                                    const response = await api.get(
                                      `/nutritionist/queue/${detailData.mealPlan.id}/clinical-evidence/${item.id}/file`,
                                      { responseType: 'blob' }
                                    );
                                    const url = URL.createObjectURL(response.data);
                                    const anchor = document.createElement('a');
                                    anchor.href = url;
                                    anchor.download = 'clinical-document';
                                    anchor.click();
                                    setTimeout(() => URL.revokeObjectURL(url), 30_000);
                                  } catch {
                                    toast.error(
                                      'The clinical document could not be opened. Refresh your review claim and try again.'
                                    );
                                  }
                                }}
                              >
                                Download original record
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* General Info Grid */}
                    <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-brand-border">
                      <div>
                        <span className="block text-[10px] text-brand-muted">Target Goal</span>
                        <strong className="text-brand-text text-xs uppercase">{detailData.user.goal}</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-brand-muted">Daily Target</span>
                        <strong className="text-brand-text text-xs">{detailData.user.dailyCalorieTarget} kcal</strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-brand-muted">Diet Preference</span>
                        <strong className="text-brand-text text-xs uppercase">
                          {detailData.user.dietaryPreference}
                        </strong>
                      </div>
                      <div>
                        <span className="block text-[10px] text-brand-muted">Rice Preference</span>
                        <strong className="text-brand-text text-xs uppercase">{detailData.user.ricePreference}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Right Panel: Meal Details */}
                  <div className="space-y-4 rounded-[24px] border border-brand-border/70 bg-brand-surface/70 p-5 shadow-card">
                    <div className="border-b border-brand-border pb-3 flex justify-between items-start">
                      <div>
                        <h2 className="text-sm font-bold text-brand-muted uppercase tracking-wider">Meal Details</h2>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editForm.mealName}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, mealName: e.target.value }))}
                            className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-sm font-extrabold w-full mt-2 focus:outline-none focus:border-brand-green"
                          />
                        ) : (
                          <h3 className="text-base font-extrabold text-brand-text mt-1">
                            {detailData.mealPlan.mealName}
                          </h3>
                        )}
                        <p className="text-xs text-brand-muted mt-1 uppercase">
                          {detailData.mealPlan.mealType} • Generated{' '}
                          {new Date(detailData.mealPlan.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Meal Image Visual */}
                    <div className="overflow-hidden rounded-2xl border border-brand-border/60">
                      <MealImage
                        mealName={detailData.mealPlan.mealName}
                        mealType={detailData.mealPlan.mealType}
                        image={(detailData.mealPlan as { image?: PublicMealImage | null }).image ?? null}
                        variant="card"
                        className="h-44 w-full sm:h-52"
                        showAttributionLinks
                      />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-brand-muted">Description</h4>
                      {isEditing ? (
                        <textarea
                          value={editForm.description}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                          rows={3}
                          className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-brand-green resize-none"
                        />
                      ) : (
                        <p className="text-xs text-brand-muted leading-relaxed">
                          {detailData.mealPlan.description || 'No description available.'}
                        </p>
                      )}
                    </div>

                    {/* Nutrition targets */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-brand-muted">Nutrition Data</h4>
                      {isEditing ? (
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div>
                            <label className="block text-[10px] text-brand-muted">Calories</label>
                            <input
                              type="number"
                              value={editForm.calories}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, calories: parseFloat(e.target.value) || 0 }))
                              }
                              className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-brand-muted">Protein (g)</label>
                            <input
                              type="number"
                              value={editForm.proteinG}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, proteinG: parseFloat(e.target.value) || 0 }))
                              }
                              className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-brand-muted">Carbs (g)</label>
                            <input
                              type="number"
                              value={editForm.carbsG}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, carbsG: parseFloat(e.target.value) || 0 }))
                              }
                              className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-brand-muted">Fat (g)</label>
                            <input
                              type="number"
                              value={editForm.fatG}
                              onChange={(e) =>
                                setEditForm((prev) => ({ ...prev, fatG: parseFloat(e.target.value) || 0 }))
                              }
                              className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 w-full mt-1 focus:outline-none focus:border-brand-green"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-4 text-xs text-brand-muted items-center">
                          <span className="flex items-center gap-1 font-bold text-amber-500">
                            <Flame className="w-3.5 h-3.5 fill-current" />
                            <span>{detailData.mealPlan.calories.toFixed(0)} kcal</span>
                          </span>
                          <span>
                            P: <strong>{detailData.mealPlan.proteinG.toFixed(1)}g</strong>
                          </span>
                          <span>
                            C: <strong>{detailData.mealPlan.carbsG.toFixed(1)}g</strong>
                          </span>
                          <span>
                            F: <strong>{detailData.mealPlan.fatG.toFixed(1)}g</strong>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Ingredients list */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-brand-muted flex justify-between items-center">
                        <span>Ingredients</span>
                        {isEditing && (
                          <button
                            onClick={addIngredientField}
                            className="text-brand-green hover:underline text-[11px] flex items-center gap-0.5"
                          >
                            <Plus className="w-3 h-3" /> Add Ingredient
                          </button>
                        )}
                      </h4>
                      <div className="space-y-2">
                        {isEditing ? (
                          editForm.ingredients.map((ing, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={ing.name}
                                onChange={(e) => updateIngredientField(idx, e.target.value)}
                                placeholder="Ingredient name..."
                                className="bg-brand-bg text-brand-text border border-brand-border rounded px-2 py-1 text-xs flex-grow focus:outline-none focus:border-brand-green"
                              />
                              <Badge
                                variant={
                                  ing.dataSource === 'FNRI'
                                    ? 'verified'
                                    : ing.dataSource === 'SOURCE_RECIPE'
                                      ? 'user'
                                      : 'pending'
                                }
                                className="text-[8px] uppercase select-none"
                              >
                                {ing.dataSource === 'FNRI'
                                  ? 'FNRI'
                                  : ing.dataSource === 'SOURCE_RECIPE'
                                    ? 'Source'
                                    : 'AI est.'}
                              </Badge>
                              <button
                                onClick={() => removeIngredientField(idx)}
                                className="p-1 text-red-500 hover:bg-red-950/20 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <IngredientEvidenceList ingredients={detailData.ingredients} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Auto-Warnings list */}
                {detailData.warnings.length > 0 && (
                  <div className="border border-brand-border rounded-xl p-5 bg-brand-surface/40 space-y-3">
                    <h4 className="text-xs font-bold text-brand-muted flex items-center gap-1.5 uppercase tracking-wider">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      Pre-computed Clinical Warnings
                    </h4>
                    <div className="space-y-2">
                      {detailData.warnings.map((w, idx) => {
                        let severityStyles =
                          'border-brand-cyan/20 bg-brand-cyan/10 text-brand-green dark:text-brand-cyan';
                        if (w.severity === 'CRITICAL') {
                          severityStyles = 'text-red-400 bg-red-950/30 border-red-900/30';
                        } else if (w.severity === 'IMPORTANT') {
                          severityStyles = 'text-amber-500 bg-amber-950/20 border-amber-800/20';
                        }
                        return (
                          <div
                            key={idx}
                            className={`p-3 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 ${severityStyles}`}
                          >
                            {w.severity === 'CRITICAL' && (
                              <ShieldAlert className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
                            )}
                            {w.severity === 'IMPORTANT' && (
                              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                            )}
                            {w.severity === 'NOTICE' && (
                              <Info className="mt-0.5 h-4 w-4 shrink-0 text-brand-green dark:text-brand-cyan" />
                            )}
                            <span>{w.message}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {detailData.claimStatus.claimedByMe && (
                  <>
                    {/* Note to Patient form input */}
                    <div className="bg-brand-surface/30 border border-brand-border rounded-xl p-5 space-y-3">
                      <h4 className="text-xs font-bold text-brand-muted uppercase tracking-wider">
                        Note to Patient (optional)
                      </h4>
                      <textarea
                        value={generalNote}
                        onChange={(e) => setGeneralNote(e.target.value)}
                        placeholder="Include a helpful message, advice, or summary context for the patient. They will see this alongside their approved meal."
                        rows={2}
                        className="bg-brand-bg text-brand-text border border-brand-border rounded-xl px-4 py-3 text-xs w-full focus:outline-none focus:border-brand-green resize-none leading-relaxed"
                      />
                    </div>

                    {/* Rejection forms section with In-Flight Candidate Replacement */}
                    <CaseReplacementForm review={review} />

                    {/* Action buttons footer */}
                    {!showRejectForm && (
                      <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:gap-3">
                        {isEditing ? (
                          <>
                            <Button
                              variant="primary"
                              onClick={handleApprove}
                              isLoading={actionLoading === selectedMealId}
                              className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.98]"
                            >
                              <Check className="w-4 h-4" />
                              <span>
                                {detailData.highRiskReviewRequired && detailData.reviewApprovalCount === 0
                                  ? 'Save first approval'
                                  : 'Save & Approve'}
                              </span>
                            </Button>
                            <Button
                              variant="secondary"
                              onClick={() => setIsEditing(false)}
                              className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 text-center justify-center"
                            >
                              Cancel Edit
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="primary"
                              onClick={handleApprove}
                              isLoading={actionLoading === selectedMealId}
                              className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.98]"
                            >
                              <Check className="w-4 h-4" />
                              <span>
                                {detailData.highRiskReviewRequired && detailData.reviewApprovalCount === 0
                                  ? 'Submit first approval'
                                  : 'Approve'}
                              </span>
                            </Button>
                            <p className="text-xs text-brand-muted">
                              Approvals cover this exact saved plate. Use case replacement for a different meal, or
                              create an altered recipe in the meal library for independent review.
                            </p>
                            <Button
                              variant="danger"
                              onClick={() => setShowRejectForm(true)}
                              className="w-full sm:w-auto text-xs px-6 sm:px-8 py-2.5 flex items-center justify-center gap-1.5"
                            >
                              <X className="w-4 h-4" />
                              <span>Reject</span>
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            ) : null}
          </ExpandableCasePanel>
        </div>
      </div>
    </div>
  );
}

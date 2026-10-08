'use client';
import SplitWorkspace from '@/components/shared/SplitWorkspace';

import PortalPageHeader from '@/components/shared/PortalPageHeader';

import Button from '@/components/ui/Button';

import { ReviewDetailSkeleton } from '@/features/nutritionist-reviews/NutritionistReviewsSkeleton';

import { AlertTriangle, Info, ShieldAlert, ShieldCheck } from 'lucide-react';

import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';

import CaseReviewQueue from './CaseReviewQueue';
import { Props } from '@/features/nutritionist-reviews/sections/CaseReviewWorkspace.shared';

import { useCaseReviewWorkspaceModel } from '@/features/nutritionist-reviews/sections/useCaseReviewWorkspaceModel';
import CaseProfileSection from '@/features/nutritionist-reviews/sections/CaseProfileSection';
import CaseAuditSection from '@/features/nutritionist-reviews/sections/CaseAuditSection';
import CaseDecisionSection from '@/features/nutritionist-reviews/sections/CaseDecisionSection';
export default function CaseReviewWorkspace({
  review,
  caseFilter,
  expanded,
  setExpanded,
  navigation,
  caseFilters,
}: Props) {
  const model = useCaseReviewWorkspaceModel({ review, caseFilter, expanded, setExpanded, navigation, caseFilters });

  const { selectedMealId, claimHeader, setSelectedMealId, detailLoading, errorMsg, detailData } = model;
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
        <SplitWorkspace className="flex md:h-[calc(100vh-270px)] md:min-h-[640px] flex-col overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface text-left shadow-sm md:flex-row">
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
              <div
                role="alert"
                className="p-6 bg-red-950/20 border border-red-500/20 rounded-xl space-y-4 max-w-lg mx-auto mt-12 text-center"
              >
                <ShieldAlert className="w-12 h-12 text-red-500 mx-auto" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-brand-text">Review details unavailable</h3>
                  <p className="text-xs text-brand-muted">{errorMsg}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={() => void review.handleSelectMeal(selectedMealId)} className="text-xs px-6">
                    Retry details
                  </Button>
                  <Button variant="secondary" onClick={() => setSelectedMealId(null)} className="text-xs px-6">
                    Back to Queue
                  </Button>
                </div>
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
                    Review the recorded health context before approving this meal.
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
                  <CaseProfileSection model={model} />

                  {/* Right Panel: Meal Details */}
                  <CaseAuditSection model={model} />
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

                <CaseDecisionSection model={model} />
              </div>
            ) : null}
          </ExpandableCasePanel>
        </SplitWorkspace>
      </div>
    </div>
  );
}

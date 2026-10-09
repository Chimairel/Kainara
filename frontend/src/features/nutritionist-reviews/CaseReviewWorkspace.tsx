'use client';
import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import SplitWorkspace from '@/components/shared/SplitWorkspace';

import PortalPageHeader from '@/components/shared/PortalPageHeader';

import Button from '@/components/ui/Button';

import { ReviewDetailSkeleton } from '@/features/nutritionist-reviews/NutritionistReviewsSkeleton';

import { ShieldAlert, ShieldCheck } from 'lucide-react';

import ExpandableCasePanel from '@/features/nutritionist-reviews/ExpandableCasePanel';

import CaseReviewQueue from './CaseReviewQueue';
import { Props } from '@/features/nutritionist-reviews/sections/CaseReviewWorkspace.shared';

import { useCaseReviewWorkspaceModel } from '@/features/nutritionist-reviews/sections/useCaseReviewWorkspaceModel';
import CaseReviewDocument from './CaseReviewDocument';
export default function CaseReviewWorkspace({
  review,
  caseFilter,
  expanded,
  setExpanded,
  navigation,
  caseFilters,
}: Props) {
  const model = useCaseReviewWorkspaceModel({ review, caseFilter, expanded, setExpanded, navigation, caseFilters });
  const [notesOpen, setNotesOpen] = useState(false);

  const { selectedMealId, claimHeader, setSelectedMealId, detailLoading, errorMsg, detailData } = model;
  useEffect(() => {
    if (!selectedMealId && expanded) setExpanded(false);
  }, [selectedMealId, expanded, setExpanded]);
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
        {review.reviewNotice && (
          <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-border bg-brand-bgAlt p-4 text-sm">
            <p className="flex-1">{review.reviewNotice}</p>
            {!!review.savedReviewNotes?.length && <Button variant="secondary" onClick={() => setNotesOpen(true)}>View saved notes</Button>}
            <Button variant="secondary" onClick={review.dismissReviewNotice}>Dismiss</Button>
          </div>
        )}
        <Modal isOpen={notesOpen} onClose={() => setNotesOpen(false)} title="Unfinished review notes" description="Notes from outdated reviews. These stay in this account’s current session and are not submitted as decisions.">
          <div className="space-y-4">{review.savedReviewNotes?.map((draft, index) => <section key={index} className="space-y-2 rounded-xl border border-brand-border p-4">
            <h3 className="font-bold">{draft.mealName}</h3>
            <p className="text-xs text-brand-muted">Outdated review context</p>
            {draft.note && <div><h4 className="font-bold">Member note</h4><p className="whitespace-pre-wrap">{draft.note}</p></div>}
            {draft.rejection && <div><h4 className="font-bold">Rejection rationale</h4><p className="whitespace-pre-wrap">{draft.rejection}</p></div>}
            {draft.clarification && <div className="space-y-2"><h4 className="font-bold">{draft.clarification.title}</h4>{draft.clarification.questions.map(question => <div key={question.id}><p className="whitespace-pre-wrap">{question.label || 'Untitled question'}</p>{question.type === 'CHOICE' && <p className="whitespace-pre-wrap text-brand-muted">{question.choices}</p>}</div>)}</div>}
          </section>)}</div>
        </Modal>
        <SplitWorkspace className="flex md:h-[calc(100vh-270px)] md:min-h-[640px] flex-col overflow-hidden rounded-3xl border border-brand-border/70 bg-brand-surface text-left shadow-sm md:flex-row">
          {/* Master Queue List Panel */}
          <CaseReviewQueue review={review} caseFilter={caseFilter} expanded={expanded} />

          {/* Details View Panel */}
          <div
            className={`${selectedMealId ? 'flex' : 'hidden md:flex'} h-full min-w-0 flex-1 flex-col overflow-y-auto p-3 custom-scrollbar sm:p-4`}
          >
            {selectedMealId && detailData && !detailLoading ? (
              <CaseReviewDocument model={model} />
            ) : (
              <ExpandableCasePanel
                expanded={expanded && selectedMealId !== null}
                onExpandedChange={setExpanded}
                canExpand={false}
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
                            desc: 'Approve the recorded meal, reject with a reason, or swap to an eligible recipe. Add guidance in your review notes.',
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
                ) : null}
              </ExpandableCasePanel>
            )}
          </div>
        </SplitWorkspace>
      </div>
    </div>
  );
}

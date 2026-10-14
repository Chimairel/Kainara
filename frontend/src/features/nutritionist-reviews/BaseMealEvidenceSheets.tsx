'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';
import Badge from '@/components/ui/Badge';
import MealImage from '@/components/user/MealImage';
import IngredientEvidenceTable from './IngredientEvidenceTable';
import { recordedIngredients } from './recorded-ingredients';
import { ReviewDocumentPage } from './RndQueueDocument';
import { ShieldCheck } from '@/components/ui/icons';
import type { PublicMealImage } from '@/types';
import type { MealCandidate } from './MealVerificationQueue';

export type BaseMealEvidence = Omit<MealCandidate, 'status'> & { status: string };
/** Shared base-verification papers, also used when flagging an existing meal. */
export default function BaseMealEvidenceSheets({ selected, error, image }: { selected: BaseMealEvidence; error?: string | null; image?: PublicMealImage | null }) {
  return <>
              <ReviewDocumentPage page={1} title="Base meal verification" subtitle={selected.name}>
                {error && <FeedbackNotice>{error}</FeedbackNotice>}

                {selected.claimedByMe && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-brand-green/20 bg-brand-green/10 p-3 text-xs text-brand-green">
                    <ShieldCheck className="h-4 w-4 shrink-0" />
                    <span>
                      30-minute exclusive verification lock active. Submit before expiry to prevent automatic release.
                    </span>
                  </div>
                )}

                {/* Recipe Header & Details */}
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-brand-border pb-3">
                    <span className="inline-block rounded-full bg-brand-accent/10 px-3 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-accent">
                      {selected.mealType} · {selected.source.replaceAll('_', ' ')}
                    </span>
                    <Badge variant={selected.status === 'VERIFIED' ? 'verified' : selected.status === 'PENDING' ? 'pending' : 'rejected'} className="text-[10px]">
                      {selected.status}
                    </Badge>
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">{selected.name}</h2>
                    <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                      {selected.description || 'No description recorded.'}
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-brand-border/60">
                    <MealImage
                      image={
                        image !== undefined ? image : selected.imageUrl
                          ? {
                              url: selected.imageUrl,
                              altText: selected.name,
                              kind: 'EXACT',
                              attribution: {
                                creator: 'RND supplied',
                                sourcePageUrl: null,
                                licenseCode: null,
                                licenseUrl: null,
                                modifications: 'Adapted recipe',
                              },
                            }
                          : null
                      }
                      mealName={selected.name}
                      mealType={selected.mealType}
                      variant="card"
                      className="h-44 w-full sm:h-52"
                      showAttributionLinks
                    />
                  </div>

                  {/* Nutritional Breakdown */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Calories</span>
                      <p className="text-base font-black text-brand-text mt-0.5">
                        {selected.calories ?? '—'} <span className="text-xs font-normal text-brand-muted">kcal</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Protein</span>
                      <p className="text-base font-black text-brand-text mt-0.5">
                        {selected.proteinG ?? '—'} <span className="text-xs font-normal text-brand-muted">g</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Carbs</span>
                      <p className="text-base font-black text-brand-text mt-0.5">
                        {selected.carbsG ?? '—'} <span className="text-xs font-normal text-brand-muted">g</span>
                      </p>
                    </div>
                    <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-center">
                      <span className="text-[10px] uppercase font-bold text-brand-muted tracking-wider">Fat</span>
                      <p className="text-base font-black text-brand-text mt-0.5">
                        {selected.fatG ?? '—'} <span className="text-xs font-normal text-brand-muted">g</span>
                      </p>
                    </div>
                  </div>
                </div>
              </ReviewDocumentPage>
              <ReviewDocumentPage page={2} title="Recipe ingredients" subtitle={selected.name}>
                {/* Recorded Ingredients */}
                <div className="space-y-4">
                  <h3 className="font-display text-sm font-bold text-brand-text">Recorded ingredients</h3>
                  {selected.riceRole === 'PAIR_WITH_RICE' && (
                    <p className="text-xs text-brand-muted">
                      Review rice pairing from {(selected.riceMinHalfCups ?? 1) / 2} to{' '}
                      {(selected.riceMaxHalfCups ?? 3) / 2} cups, in half-cup steps. Cup estimates use 150 g of cooked
                      rice; the saved grams and food record determine nutrition.
                    </p>
                  )}
                  {selected.riceRole === 'INCLUDES_RICE' && (
                    <p className="text-xs text-brand-muted">
                      Rice is already included. Do not add another rice component.
                    </p>
                  )}
                  <IngredientEvidenceTable ingredients={recordedIngredients(selected.ingredients)} />
                </div>

                <div className="rounded-xl border border-[#a64600]/30 bg-[#8c3b00]/10 p-3.5 text-xs text-[#8c3b00] font-semibold leading-relaxed">
                  Verification confirms the base dish only. It does not certify nutrition amounts or permit use for a
                  health condition.
                </div>
              </ReviewDocumentPage>
  </>;
}

'use client';

import { AlertCircle, Clock3, Flame, Info, ShieldCheck, Sparkles, UtensilsCrossed } from 'lucide-react';
import { MealMotionDiv } from '../../components/user/MealMotion';

import { maskPrcLicenseNumber } from '../../components/user/NutritionistCredentialModal';

import type { useMealCardModel } from './useMealCardModel';
type Model = Extract<ReturnType<typeof useMealCardModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'animateMeal'
    | 'isUnloggedPastMeal'
    | 'isPastGracePeriod'
    | 'isFutureDate'
    | 'calories'
    | 'proteinPct'
    | 'carbsPct'
    | 'fatPct'
    | 'proteinG'
    | 'carbsG'
    | 'fatG'
    | 'ricePortion'
    | 'description'
    | 'explanation'
    | 'verifier'
    | 'setVerifierModalTab'
    | 'setIsVerifierOpen'
    | 'displayVerifier'
    | 'nutritionistNote'
    | 'cookingLink'
    | 'cooking'
    | 'ingredients'
    | 'status'
  >;
};
export default function MealCardModalBody({ model }: SectionProps) {
  const {
    animateMeal,
    isUnloggedPastMeal,
    isPastGracePeriod,
    isFutureDate,
    calories,
    proteinPct,
    carbsPct,
    fatPct,
    proteinG,
    carbsG,
    fatG,
    ricePortion,
    description,
    explanation,
    verifier,
    setVerifierModalTab,
    setIsVerifierOpen,
    displayVerifier,
    nutritionistNote,
    cookingLink,
    cooking,
    ingredients,
    status,
  } = model;

  return (
    <>
      <MealMotionDiv
        enabled={animateMeal}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="p-5 sm:p-7 pb-8 sm:pb-9 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5"
      >
        {/* Notice Banners */}
        {isUnloggedPastMeal && !isPastGracePeriod && (
          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-2">
            <Clock3 className="h-4 w-4 shrink-0" />
            <span>Missed this meal? You can still catch up and record whether you ate or skipped it.</span>
          </div>
        )}
        {isPastGracePeriod && (
          <div className="p-3 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>The 7-day logging grace period for this scheduled meal has passed.</span>
          </div>
        )}
        {isFutureDate && (
          <p className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/40 p-3 text-xs text-brand-muted">
            This meal can be viewed or swapped now. Record it on its scheduled date.
          </p>
        )}
        {/* Premium Macro Breakdown Cockpit */}
        <div className="rounded-2xl sm:rounded-3xl border border-brand-border/70 bg-gradient-to-b from-brand-surface to-brand-bgAlt/50 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Flame className="h-3.5 w-3.5" />
              </div>
              <span className="text-[11px] font-black uppercase tracking-wider text-brand-muted">
                Macro Distribution
              </span>
            </div>
            <span className="text-xs font-bold text-brand-muted">{Math.round(calories)} kcal</span>
          </div>

          {/* Segmented Macro Balance Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10 flex mb-4">
            <div
              style={{ width: `${proteinPct}%` }}
              className="bg-[#08705b] dark:bg-[#10b981] transition-all duration-500"
              title={`Protein: ${proteinPct}%`}
            />
            <div
              style={{ width: `${carbsPct}%` }}
              className="bg-[#18b9d2] dark:bg-[#38bdf8] transition-all duration-500"
              title={`Carbs: ${carbsPct}%`}
            />
            <div
              style={{ width: `${fatPct}%` }}
              className="bg-[#eb6a38] transition-all duration-500"
              title={`Fat: ${fatPct}%`}
            />
          </div>

          {/* 3 Interactive Metric Cards */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
            {/* Protein Card */}
            <div className="rounded-2xl border border-[#08705b]/20 dark:border-[#10b981]/30 bg-gradient-to-b from-[#08705b]/10 to-[#08705b]/[0.02] dark:from-[#10b981]/15 dark:to-transparent p-3 sm:p-4 text-center transition-all hover:border-[#08705b]/40 shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#08705b] dark:text-[#34d399]">
                <span className="h-2 w-2 rounded-full bg-[#08705b] dark:bg-[#34d399]" />
                Protein
              </div>
              <span className="block text-2xl sm:text-3xl font-black font-display text-[#08705b] dark:text-[#34d399] tracking-tight mt-1">
                {Math.round(proteinG)}g
              </span>
              <span className="block text-[10px] font-bold text-brand-muted mt-0.5">{proteinPct}% of kcal</span>
            </div>

            {/* Carbs Card */}
            <div className="rounded-2xl border border-[#18b9d2]/20 dark:border-[#38bdf8]/30 bg-gradient-to-b from-[#18b9d2]/10 to-[#18b9d2]/[0.02] dark:from-[#38bdf8]/15 dark:to-transparent p-3 sm:p-4 text-center transition-all hover:border-[#18b9d2]/40 shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#0b7788] dark:text-[#38bdf8]">
                <span className="h-2 w-2 rounded-full bg-[#18b9d2] dark:bg-[#38bdf8]" />
                Carbs
              </div>
              <span className="block text-2xl sm:text-3xl font-black font-display text-[#0b7788] dark:text-[#38bdf8] tracking-tight mt-1">
                {Math.round(carbsG)}g
              </span>
              <span className="block text-[10px] font-bold text-brand-muted mt-0.5">{carbsPct}% of kcal</span>
            </div>

            {/* Fat Card */}
            <div className="rounded-2xl border border-[#eb6a38]/20 dark:border-[#eb6a38]/30 bg-gradient-to-b from-[#eb6a38]/10 to-[#eb6a38]/[0.02] dark:from-[#eb6a38]/15 dark:to-transparent p-3 sm:p-4 text-center transition-all hover:border-[#eb6a38]/40 shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#c74614] dark:text-[#f09e6c]">
                <span className="h-2 w-2 rounded-full bg-[#eb6a38] dark:bg-[#f09e6c]" />
                Fat
              </div>
              <span className="block text-2xl sm:text-3xl font-black font-display text-[#c74614] dark:text-[#f09e6c] tracking-tight mt-1">
                {Math.round(fatG)}g
              </span>
              <span className="block text-[10px] font-bold text-brand-muted mt-0.5">{fatPct}% of kcal</span>
            </div>
          </div>
        </div>

        {ricePortion && (
          <p className="rounded-xl border border-brand-border bg-brand-bgAlt p-3 text-sm font-bold">
            Dish + {ricePortion}. Nutrition totals include rice.
          </p>
        )}

        {/* Description Text */}
        {description && (
          <div className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/40 p-4 text-xs sm:text-sm text-brand-muted leading-relaxed">
            {description}
          </div>
        )}

        {/* Saved selection and nutrition evidence */}
        {explanation && explanation.bullets.length > 0 && (
          <section
            className="rounded-2xl sm:rounded-3xl border border-brand-border/80 bg-brand-bgAlt/50 dark:bg-white/[0.02] p-4 sm:p-5 shadow-xs"
            aria-label="Why this meal"
          >
            <div className="flex items-center justify-between gap-2 border-b border-brand-border/50 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-brand-green/15 text-brand-green shadow-xs">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black font-display text-brand-text">Why this meal?</h4>
                  <p className="text-[10px] text-brand-muted">How this meal fits your plan</p>
                </div>
              </div>
              {verifier && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2.5 py-1 text-[10px] font-extrabold text-brand-green border border-brand-green/20">
                  <ShieldCheck className="h-3.5 w-3.5" /> RND reviewed recipe or case
                </span>
              )}
            </div>

            <ul className="mt-3.5 space-y-2">
              {explanation.bullets.map((bullet) => {
                const isReviewerBullet = verifier && bullet.toLowerCase().includes('reviewed by');
                return (
                  <li
                    key={bullet}
                    className="flex items-start justify-between gap-2.5 rounded-xl bg-brand-surface/80 dark:bg-black/30 border border-brand-border/50 p-2.5 text-xs text-brand-text/90 leading-relaxed shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-muted" />
                      <span className="break-words">{bullet}</span>
                    </div>
                    {isReviewerBullet && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifierModalTab('notes');
                          setIsVerifierOpen(true);
                        }}
                        className="shrink-0 text-[10px] font-bold text-brand-green hover:underline flex items-center gap-0.5 ml-2 cursor-pointer"
                      >
                        View Review &amp; Notes ↗
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Clinician Verifier Endorsement */}
        {displayVerifier && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-muted flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-green" />
                <span>Verified by</span>
              </h4>
              <span className="text-[10px] font-bold text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full border border-brand-green/20">
                PRC-Licensed RND
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setVerifierModalTab('card');
                setIsVerifierOpen(true);
              }}
              className="group relative flex w-full flex-col gap-3 rounded-2xl sm:rounded-3xl border border-brand-green/30 bg-gradient-to-br from-brand-green/[0.08] via-brand-green/[0.03] to-transparent p-4 text-left transition hover:border-brand-green/60 hover:shadow-md cursor-pointer"
              aria-label={`View clinical credentials for ${displayVerifier.name}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {displayVerifier.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={displayVerifier.image}
                      alt={displayVerifier.name}
                      className="h-11 w-11 rounded-full object-cover border-2 border-brand-green/30 shadow-sm shrink-0"
                    />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-brand-green/15 border-2 border-brand-green/30 flex items-center justify-center text-brand-green font-display font-bold text-sm shrink-0">
                      {displayVerifier.name
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-display font-black text-sm text-brand-text truncate">
                        {displayVerifier.name.endsWith('RND') ? displayVerifier.name : `${displayVerifier.name}, RND`}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/15 px-2 py-0.5 text-[9px] font-black text-brand-green border border-brand-green/20">
                        <ShieldCheck className="h-3 w-3" /> PRC-Verified
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-muted truncate mt-0.5">
                      {displayVerifier.specialization || 'Clinical Dietetics & Nutrition'} •{' '}
                      {maskPrcLicenseNumber(displayVerifier.prcLicenseNumber)}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-bold text-brand-green group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                  Credentials ↗
                </span>
              </div>

              {nutritionistNote && (
                <div className="rounded-xl bg-brand-surface/90 dark:bg-black/40 border border-brand-green/20 px-3 py-2 text-xs text-brand-muted italic">
                  <span className="font-bold not-italic text-brand-green mr-1.5">RND Note:</span>
                  &ldquo;{nutritionistNote}&rdquo;
                </div>
              )}
            </button>
          </div>
        )}

        {/* Cooking & Recipe Guide */}
        <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 dark:bg-white/[0.02] p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0 p-2 rounded-xl bg-brand-surface dark:bg-black/30 border border-brand-border/60">
              {cookingLink?.kind === 'PANLASANG_RECIPE' ? '📖' : '📺'}
            </span>
            <div className="min-w-0">
              <h5 className="text-xs sm:text-sm font-bold text-brand-text leading-tight">Need cooking help?</h5>
              <p className="text-[11px] text-brand-muted mt-0.5 leading-snug line-clamp-1">{cooking.description}</p>
            </div>
          </div>
          <a
            href={cooking.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`px-4 py-2 text-white text-xs font-bold rounded-full transition-all shadow-sm flex items-center gap-1.5 shrink-0 select-none cursor-pointer outline-none hover:scale-105 active:scale-95 ${cookingLink?.kind === 'PANLASANG_RECIPE' ? 'bg-brand-green hover:brightness-95' : 'bg-[#ff0000] hover:bg-[#cc0000]'}`}
          >
            {cooking.label}
          </a>
        </div>

        {/* Ingredients List */}
        {ingredients.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <UtensilsCrossed className="h-3.5 w-3.5 text-brand-green" />
              <span className="text-[11px] tracking-wider font-extrabold text-brand-muted uppercase">
                Ingredients ({ingredients.length})
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ingredients.map((ing) => (
                <span
                  key={ing.id}
                  className="text-xs bg-brand-surface dark:bg-black/30 border border-brand-border/70 text-brand-text px-3 py-1.5 rounded-xl font-medium shadow-2xs hover:border-brand-green/30 transition-colors"
                >
                  {ing.ingredientName}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Warning Banner (Legal layer 3 & 4) */}
        {status === 'PENDING_REVIEW' && (
          <div className="p-3.5 rounded-2xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text text-xs font-semibold leading-relaxed flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              <strong>AI Estimation Warning</strong>: This plan is still pending verification by a licensed Registered
              Nutritionist-Dietitian. Use with caution.
            </span>
          </div>
        )}
      </MealMotionDiv>
    </>
  );
}

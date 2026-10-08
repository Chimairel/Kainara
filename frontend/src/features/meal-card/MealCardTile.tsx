'use client';
import ReviewedByControl from '@/components/user/ReviewedByControl';
import { PlanMealCardSurface } from '@/components/user/PlanMealCardSurface';
import { MealMacros } from '@/components/user/MealMacros';
import { formatMealTitle } from '@/lib/meal-title';

import { Check, Clock3, X } from 'lucide-react';
import { MealMotionDiv } from '../../components/user/MealMotion';

import MealVerificationBadge from '../../components/user/MealVerificationBadge';

import type { useMealCardModel } from './useMealCardModel';
type Model = Extract<ReturnType<typeof useMealCardModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'animateMeal'
    | 'layoutId'
    | 'mealName'
    | 'onCardClick'
    | 'setIsOpen'
    | 'setIsVerifierOpen'
    | 'setVerifierModalTab'
    | 'mealType'
    | 'image'
    | 'ingredients'
    | 'index'
    | 'Icon'
    | 'activeLabel'
    | 'isLogged'
    | 'status'
    | 'verifier'
    | 'isCompleted'
    | 'isSkipped'
    | 'ricePortion'
    | 'calories'
    | 'proteinG'
    | 'carbsG'
    | 'fatG'
  >;
};
export default function MealCardTile({ model }: SectionProps) {
  const {
    animateMeal,
    layoutId,
    mealName,
    onCardClick,
    setIsOpen,
    setIsVerifierOpen,
    setVerifierModalTab,
    mealType,
    image,
    ingredients,
    index,
    Icon,
    activeLabel,
    isLogged,
    status,
    verifier,
    isCompleted,
    isSkipped,
    ricePortion,
    calories,
    proteinG,
    carbsG,
    fatG,
  } = model;

  return (
    <>
      <MealMotionDiv
        enabled={animateMeal}
        layoutId={layoutId}
        role="button"
        tabIndex={0}
        aria-label={`Open ${formatMealTitle(mealName)} details`}
        onClick={() => {
          if (onCardClick) {
            onCardClick();
          } else {
            setIsOpen(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (onCardClick) {
              onCardClick();
            } else {
              setIsOpen(true);
            }
          }
        }}
        className="group relative block h-full w-full cursor-pointer select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg rounded-3xl"
      >
        <PlanMealCardSurface
          mealType={mealType}
          mealName={mealName}
          image={image}
          ingredients={ingredients}
          index={index}
          badges={
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-text shadow-sm backdrop-blur-md">
                <Icon className="h-3.5 w-3.5 text-brand-green" />
                {activeLabel.label}
              </span>
              {!isLogged && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/90 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                  <Clock3 className="h-2.5 w-2.5" /> Unlogged
                </span>
              )}
              {status === 'APPROVED' && !verifier ? (
                <span className="sr-only">Ready</span>
              ) : (
                <MealVerificationBadge
                  status={status}
                  hasVerifier={Boolean(verifier)}
                  className="scale-90 origin-right"
                />
              )}
              {isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                  <Check className="h-2.5 w-2.5 stroke-[3]" /> Eaten
                </span>
              )}
              {isSkipped && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/90 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                  <X className="h-2.5 w-2.5 stroke-[2.5]" /> Skipped
                </span>
              )}
              {status === 'PENDING_REVIEW' && !isLogged && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-black/50 px-2 py-0.5 font-mono text-[9px] font-medium text-amber-200 backdrop-blur-md">
                  <Clock3 className="h-2.5 w-2.5 text-amber-300" /> Preview
                </span>
              )}
            </>
          }
        >
          {/* Lower Details: Title, Description, and Colorful Macro Pills */}
          <div className="flex-1 flex flex-col justify-between p-2 pt-2.5">
            <div>
              <h3
                className={`text-base font-bold font-display tracking-tight text-brand-text leading-snug line-clamp-1 ${
                  isCompleted ? 'line-through text-brand-muted' : ''
                }`}
              >
                {formatMealTitle(mealName)}
              </h3>
              {ricePortion && <p className="text-xs text-brand-green">+ {ricePortion}</p>}
              <p className="text-xs text-brand-muted line-clamp-1 mt-0.5">
                {ingredients.length > 0
                  ? `Prepared with ${ingredients.map((i) => i.ingredientName).join(', ')}`
                  : 'Open this meal for its recipe details'}
              </p>
            </div>

            {verifier && (
              <ReviewedByControl
                name={verifier.name}
                scope={verifier.reviewScope}
                onClick={() => {
                  setVerifierModalTab('card');
                  setIsVerifierOpen(true);
                }}
              />
            )}
            {/* Macro Chips Row - Theme Colors */}
            <MealMacros calories={calories} proteinG={proteinG} carbsG={carbsG} fatG={fatG} className="mt-3" />
          </div>
        </PlanMealCardSurface>
      </MealMotionDiv>
    </>
  );
}

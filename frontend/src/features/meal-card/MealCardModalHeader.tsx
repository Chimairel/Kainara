'use client';

import { formatMealTitle } from '@/lib/meal-title';

import { Check, Clock3, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { MealMotionDiv } from '../../components/user/MealMotion';

import MealImage from '../../components/user/MealImage';

import type { useMealCardModel } from './useMealCardModel';
type Model = Extract<ReturnType<typeof useMealCardModel>, { kind: 'ready' }>;
type SectionProps = {
  model: Pick<
    Model,
    | 'animateMeal'
    | 'layoutId'
    | 'image'
    | 'mealName'
    | 'mealType'
    | 'ingredients'
    | 'Icon'
    | 'activeLabel'
    | 'isLogged'
    | 'displayVerifier'
    | 'status'
    | 'isCompleted'
    | 'isSkipped'
    | 'handleClose'
    | 'handleCheckedChange'
    | 'isUpdating'
    | 'isPastGracePeriod'
    | 'isFutureDate'
    | 'onSwapClick'
    | 'setIsOpen'
    | 'id'
    | 'isPastDate'
    | 'handleSkipMeal'
  >;
};
export default function MealCardModalHeader({ model }: SectionProps) {
  const {
    animateMeal,
    layoutId,
    image,
    mealName,
    mealType,
    ingredients,
    Icon,
    activeLabel,
    isLogged,
    displayVerifier,
    status,
    isCompleted,
    isSkipped,
    handleClose,
    handleCheckedChange,
    isUpdating,
    isPastGracePeriod,
    isFutureDate,
    onSwapClick,
    setIsOpen,
    id,
    isPastDate,
    handleSkipMeal,
  } = model;

  return (
    <>
      <div className="relative h-[260px] sm:h-[300px] w-full shrink-0 overflow-hidden bg-black/40">
        <MealMotionDiv enabled={animateMeal} layoutId={`image-wrap-${layoutId}`} className="h-full w-full">
          <MealImage
            image={image}
            mealName={mealName}
            mealType={mealType}
            className="h-full w-full rounded-none object-cover"
            variant="hero"
            ingredients={ingredients}
          />
        </MealMotionDiv>

        {/* Gradient overlays for contrast & seamless blending */}
        <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-36 sm:h-40 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none" />

        {/* Top Floating Bar */}
        <div className="absolute top-3.5 inset-x-3.5 sm:top-4 sm:inset-x-4 flex items-center justify-between z-20">
          {/* Left: Badges */}
          <div className="flex flex-wrap items-center gap-1.5 max-w-[80%]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-black uppercase tracking-wider text-white border border-white/20 shadow-md">
              <Icon className="h-3.5 w-3.5 text-brand-green" />
              {activeLabel.label}
            </span>

            {!isLogged && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/90 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
                <Clock3 className="h-2.5 w-2.5" /> Unlogged
              </span>
            )}

            {displayVerifier ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-600/90 px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
                <ShieldCheck className="h-3 w-3" /> RND Approved
              </span>
            ) : status === 'APPROVED' ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
                <Check className="h-2.5 w-2.5 stroke-[3]" /> Ready
              </span>
            ) : null}

            {status === 'PENDING_REVIEW' && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/90 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
                <Clock3 className="h-2.5 w-2.5" /> Awaiting Review
              </span>
            )}

            {isCompleted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/90 px-2.5 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
                <Check className="h-2.5 w-2.5 stroke-[3]" /> Eaten
              </span>
            )}

            {isSkipped && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-400/40 bg-rose-500/90 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
                <X className="h-2.5 w-2.5 stroke-[2.5]" /> Skipped
              </span>
            )}
          </div>

          {/* Right: Floating Close Button */}
          <button
            type="button"
            onClick={handleClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white/90 hover:text-white backdrop-blur-md border border-white/20 transition-all hover:scale-105 shadow-xl shrink-0"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Bottom Title & Action Buttons Overlay */}
        <div className="absolute bottom-3.5 inset-x-4 sm:bottom-4 sm:inset-x-6 z-20">
          <h3 className="text-xl sm:text-2xl md:text-3xl font-black font-display text-white tracking-tight leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] line-clamp-2">
            {formatMealTitle(mealName)}
          </h3>
          <div className="mt-2.5 sm:mt-3 flex flex-wrap items-center gap-2">
            {!isLogged ? (
              <>
                {/* Primary: Mark as Eaten */}
                <button
                  type="button"
                  onClick={() => handleCheckedChange(true)}
                  disabled={isUpdating || isPastGracePeriod || isFutureDate}
                  aria-label="Mark as eaten"
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-[#eb6a38] via-[#ed7847] to-[#f09e6c] px-3.5 py-2 text-xs font-extrabold text-white shadow-md shadow-black/40 hover:brightness-110 active:scale-95 border border-[#eb6a38]/60 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                  <span>Mark as Eaten</span>
                </button>

                {/* Secondary: Swap */}
                {onSwapClick && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onSwapClick(id);
                    }}
                    disabled={isPastDate}
                    aria-label="Swap meal"
                    className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white px-3.5 py-2 text-xs font-bold backdrop-blur-md border border-white/25 hover:border-white/40 shadow-md shadow-black/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    title={isPastDate ? 'Past scheduled meals cannot be swapped.' : undefined}
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-white/90 animate-spin-hover" />
                    <span>Swap Meal</span>
                  </button>
                )}

                {/* Destructive: Skip */}
                <button
                  type="button"
                  onClick={handleSkipMeal}
                  disabled={isUpdating || isPastGracePeriod || isFutureDate}
                  aria-label="Skip meal"
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-red-500/20 hover:bg-red-500/35 text-red-200 hover:text-white px-3.5 py-2 text-xs font-bold backdrop-blur-md border border-red-400/30 hover:border-red-400/50 shadow-md shadow-black/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <X className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Skip Meal</span>
                </button>
              </>
            ) : (
              <>
                {/* If logged, show Reset Status button */}
                <button
                  type="button"
                  onClick={() => handleCheckedChange(false)}
                  disabled={isUpdating || isPastGracePeriod || isFutureDate}
                  aria-label="Reset meal status"
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500/25 hover:bg-amber-500/40 text-amber-200 hover:text-white px-3.5 py-2 text-xs font-bold backdrop-blur-md border border-amber-400/40 shadow-md shadow-black/30 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1 text-amber-300" />
                  <span>Reset Status ({isCompleted ? 'Eaten' : 'Skipped'})</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

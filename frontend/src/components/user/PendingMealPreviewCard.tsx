'use client';

import { PlanMealCardSurface } from '@/components/user/PlanMealCardSurface';
import { MealMacros } from '@/components/user/MealMacros';
import { formatMealTitle } from '@/lib/meal-title';
import Button from '@/components/ui/Button';
import type { MealCookingLink, PublicMealImage } from '@/types';
import {
  Apple,
  CalendarDays,
  Clock3,
  Coffee,
  ExternalLink,
  Flame,
  MoonStar,
  ShieldAlert,
  Soup,
  SunMedium,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { MealMotionDiv, MealMotionPresence, useMealMotion } from './MealMotion';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import MealImage from './MealImage';
import MealVerificationBadge from './MealVerificationBadge';

export interface PendingMealPreview {
  mealName: string;
  mealType: string;
  description: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  scheduledDate: string;
  ricePortion?: string | null;
  ingredients: { ingredientName: string; category: string }[];
  image?: PublicMealImage | null;
  cookingLink?: MealCookingLink | null;
  planType?: 'STARTER' | 'WEEKLY';
}

export default function PendingMealPreviewCard({
  meal,
  index = 0,
  defaultOpen = false,
}: {
  meal: PendingMealPreview;
  index?: number;
  defaultOpen?: boolean;
}) {
  const animateMeal = useMealMotion();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  const mealTypeStyles: Record<
    string,
    {
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      iconClassName: string;
      iconSurfaceClassName: string;
    }
  > = {
    BREAKFAST: {
      label: 'Breakfast',
      icon: Coffee,
      iconClassName: 'text-brand-green',
      iconSurfaceClassName: 'border-brand-accent/45 bg-brand-accent/15',
    },
    LUNCH: {
      label: 'Lunch',
      icon: SunMedium,
      iconClassName: 'text-brand-green',
      iconSurfaceClassName: 'border-brand-green/20 bg-brand-green/10',
    },
    DINNER: {
      label: 'Dinner',
      icon: MoonStar,
      iconClassName: 'text-brand-violet',
      iconSurfaceClassName: 'border-brand-violet/25 bg-brand-violet/10',
    },
    SNACK: {
      label: 'Snack',
      icon: Apple,
      iconClassName: 'text-brand-green dark:text-brand-cyan',
      iconSurfaceClassName: 'border-brand-cyan/25 bg-brand-cyan/10',
    },
  };

  const typeStyle = mealTypeStyles[meal.mealType] ?? {
    label: meal.mealType.toLowerCase(),
    icon: Soup,
    iconClassName: 'text-brand-green',
    iconSurfaceClassName: 'border-brand-green/20 bg-brand-green/10',
  };
  const MealTypeIcon = typeStyle.icon;
  const scheduledDate = new Date(meal.scheduledDate).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  const layoutId = `pending-meal-${meal.mealType}-${meal.mealName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${meal.scheduledDate}`;

  // Keyboard escape listener and body scroll lock
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const proteinKcal = meal.proteinG * 4;
  const carbsKcal = meal.carbsG * 4;
  const fatKcal = meal.fatG * 9;
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal;
  const calBase = meal.calories > 0 ? meal.calories : totalMacroKcal > 0 ? totalMacroKcal : 1;
  const proteinPct = Math.min(100, Math.max(0, Math.round((proteinKcal / calBase) * 100)));
  const carbsPct = Math.min(100, Math.max(0, Math.round((carbsKcal / calBase) * 100)));
  const fatPct = Math.min(100, Math.max(0, Math.round((fatKcal / calBase) * 100)));

  return (
    <>
      <MealMotionDiv
        enabled={animateMeal}
        layoutId={layoutId}
        onClick={() => setIsOpen(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-label={`Open ${formatMealTitle(meal.mealName)} details`}
        className="group relative block h-full w-full cursor-pointer select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg rounded-3xl"
      >
        <PlanMealCardSurface
          mealType={meal.mealType}
          mealName={meal.mealName}
          image={meal.image}
          ingredients={meal.ingredients}
          index={index}
          badges={
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-black/60 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-brand-text shadow-sm backdrop-blur-md">
                <MealTypeIcon className="h-3.5 w-3.5 text-brand-green" />
                {typeStyle.label}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/90 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white shadow-xs backdrop-blur-md">
                <Clock3 className="h-2.5 w-2.5" /> Unlogged
              </span>
              <MealVerificationBadge status="PENDING_REVIEW" className="scale-90 origin-right" />
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-black/50 px-2 py-0.5 font-mono text-[9px] font-medium text-amber-200 backdrop-blur-md">
                <Clock3 className="h-2.5 w-2.5 text-amber-300" /> Preview
              </span>
            </>
          }
        >
          {/* Lower Details: Title, Description, and Colorful Macro Pills */}
          <div className="flex-1 flex flex-col justify-between p-2 pt-2.5">
            <div>
              <h3 className="text-base font-bold font-display tracking-tight text-brand-text leading-snug line-clamp-1">
                {formatMealTitle(meal.mealName)}
              </h3>
              {meal.ricePortion && <p className="text-xs text-brand-green">+ {meal.ricePortion}</p>}
              <p className="text-xs text-brand-muted line-clamp-1 mt-0.5">
                {meal.description ||
                  (meal.ingredients.length > 0
                    ? meal.ingredients
                        .slice(0, 3)
                        .map((i) => i.ingredientName)
                        .join(', ')
                    : 'Meal awaiting nutritionist review')}
              </p>
            </div>

            {/* Macro Chips Row - Theme Colors */}
            <MealMacros
              calories={meal.calories}
              proteinG={meal.proteinG}
              carbsG={meal.carbsG}
              fatG={meal.fatG}
              className="mt-3"
            />
          </div>
        </PlanMealCardSurface>
      </MealMotionDiv>

      {/* Expandable Modal Dialog using Watermelon Expandable-Card Animation Pattern */}
      {isMounted &&
        createPortal(
          <MealMotionPresence enabled={animateMeal}>
            {isOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
                {/* Backdrop */}
                <MealMotionDiv
                  enabled={animateMeal}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsOpen(false)}
                  className="fixed inset-0 bg-black/80 md:backdrop-blur-xl"
                />

                {/* Expanded Modal Card */}
                <MealMotionDiv
                  enabled={animateMeal}
                  layoutId={layoutId}
                  className="relative z-10 my-auto w-full max-w-2xl overflow-hidden rounded-[28px] sm:rounded-[32px] border border-white/20 dark:border-white/10 bg-brand-surface shadow-[0_25px_70px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.85)] max-h-[92vh] flex flex-col text-left select-none ring-1 ring-black/5 dark:ring-white/5"
                >
                  {/* Hero Image Container */}
                  <div className="relative h-60 sm:h-72 w-full shrink-0 overflow-hidden bg-black/40">
                    <MealMotionDiv enabled={animateMeal} layoutId={`image-wrap-${layoutId}`} className="h-full w-full">
                      <MealImage
                        image={meal.image}
                        mealName={meal.mealName}
                        mealType={meal.mealType}
                        className="h-full w-full rounded-none object-cover"
                        variant="hero"
                        ingredients={meal.ingredients}
                      />
                    </MealMotionDiv>

                    {/* Gradient overlays for contrast & seamless blending */}
                    <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-black/80 via-black/40 to-transparent pointer-events-none" />
                    <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/90 via-black/55 to-transparent pointer-events-none" />

                    {/* Top Floating Bar */}
                    <div className="absolute top-3.5 inset-x-3.5 sm:top-4 sm:inset-x-4 flex items-center justify-between z-20">
                      {/* Left: Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 max-w-[80%]">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-md px-3 py-1 text-xs font-black uppercase tracking-wider text-white border border-white/20 shadow-md">
                          <MealTypeIcon className="h-3.5 w-3.5 text-brand-green" />
                          {typeStyle.label}
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-amber-500/90 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-white shadow-md backdrop-blur-md">
                          <Clock3 className="h-2.5 w-2.5" /> Unlogged
                        </span>

                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/40 bg-black/60 px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-300 shadow-md backdrop-blur-md">
                          <Clock3 className="h-2.5 w-2.5 text-amber-300" /> Awaiting Review
                        </span>
                      </div>

                      {/* Right: Floating Close Button */}
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 hover:bg-black/90 text-white/90 hover:text-white backdrop-blur-md border border-white/20 transition-all hover:scale-105 shadow-xl shrink-0"
                        aria-label="Close modal"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Bottom Title & Meta Overlay */}
                    <div className="absolute bottom-3.5 inset-x-4 sm:bottom-4 sm:inset-x-6 z-20">
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-black font-display text-white tracking-tight leading-tight drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] line-clamp-2">
                        {formatMealTitle(meal.mealName)}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 backdrop-blur-md px-2.5 py-0.5 text-xs font-bold text-white border border-white/25 shadow-xs">
                          <Flame className="h-3.5 w-3.5 text-amber-300" />
                          {Math.round(meal.calories)} kcal Total Energy
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-black/40 backdrop-blur-md px-2.5 py-0.5 text-xs font-semibold text-white/90 border border-white/15 shadow-xs">
                          <CalendarDays className="h-3 w-3 text-brand-green" />
                          {scheduledDate}
                        </span>
                        {meal.image?.attribution.sourcePageUrl && (
                          <a
                            href={meal.image.attribution.sourcePageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-md px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 border border-emerald-400/30 transition-colors shadow-xs"
                          >
                            <span>View image source</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <MealMotionDiv
                    enabled={animateMeal}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-5 sm:p-7 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5"
                  >
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
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-400">
                          <Clock3 className="h-3.5 w-3.5" />
                          Awaiting RND Review
                        </div>
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
                            {Math.round(meal.proteinG)}g
                          </span>
                          <span className="block text-[10px] font-bold text-brand-muted mt-0.5">
                            {proteinPct}% of kcal
                          </span>
                        </div>

                        {/* Carbs Card */}
                        <div className="rounded-2xl border border-[#18b9d2]/20 dark:border-[#38bdf8]/30 bg-gradient-to-b from-[#18b9d2]/10 to-[#18b9d2]/[0.02] dark:from-[#38bdf8]/15 dark:to-transparent p-3 sm:p-4 text-center transition-all hover:border-[#18b9d2]/40 shadow-xs">
                          <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#0b7788] dark:text-[#38bdf8]">
                            <span className="h-2 w-2 rounded-full bg-[#18b9d2] dark:bg-[#38bdf8]" />
                            Carbs
                          </div>
                          <span className="block text-2xl sm:text-3xl font-black font-display text-[#0b7788] dark:text-[#38bdf8] tracking-tight mt-1">
                            {Math.round(meal.carbsG)}g
                          </span>
                          <span className="block text-[10px] font-bold text-brand-muted mt-0.5">
                            {carbsPct}% of kcal
                          </span>
                        </div>

                        {/* Fat Card */}
                        <div className="rounded-2xl border border-[#eb6a38]/20 dark:border-[#eb6a38]/30 bg-gradient-to-b from-[#eb6a38]/10 to-[#eb6a38]/[0.02] dark:from-[#eb6a38]/15 dark:to-transparent p-3 sm:p-4 text-center transition-all hover:border-[#eb6a38]/40 shadow-xs">
                          <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#c74614] dark:text-[#f09e6c]">
                            <span className="h-2 w-2 rounded-full bg-[#eb6a38] dark:bg-[#f09e6c]" />
                            Fat
                          </div>
                          <span className="block text-2xl sm:text-3xl font-black font-display text-[#c74614] dark:text-[#f09e6c] tracking-tight mt-1">
                            {Math.round(meal.fatG)}g
                          </span>
                          <span className="block text-[10px] font-bold text-brand-muted mt-0.5">{fatPct}% of kcal</span>
                        </div>
                      </div>
                    </div>

                    {/* Description Text */}
                    {meal.description && (
                      <div className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/40 p-4 text-xs sm:text-sm text-brand-muted leading-relaxed">
                        {meal.description}
                      </div>
                    )}

                    {meal.cookingLink && (
                      <div className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 dark:bg-white/[0.02] p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-2xl shrink-0 p-2 rounded-xl bg-brand-surface dark:bg-black/30 border border-brand-border/60">
                            {meal.cookingLink.kind === 'PANLASANG_RECIPE' ? '📖' : '📺'}
                          </span>
                          <div className="min-w-0">
                            <h5 className="text-xs sm:text-sm font-bold text-brand-text leading-tight">
                              Need cooking help?
                            </h5>
                            <p className="text-[11px] text-brand-muted mt-0.5 leading-snug line-clamp-1">
                              {meal.cookingLink.kind === 'PANLASANG_RECIPE'
                                ? 'View original Panlasang Pinoy recipe guide'
                                : 'Watch original recipe preparation video'}
                            </p>
                          </div>
                        </div>
                        <a
                          href={meal.cookingLink.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-4 py-2 text-white text-xs font-bold rounded-full bg-brand-green hover:brightness-95 transition-all shadow-sm shrink-0 select-none cursor-pointer outline-none hover:scale-105 active:scale-95"
                        >
                          View Recipe ↗
                        </a>
                      </div>
                    )}

                    {/* Proposed Ingredients */}
                    {meal.ingredients && meal.ingredients.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2.5">
                          <UtensilsCrossed className="h-3.5 w-3.5 text-brand-green" />
                          <span className="text-[11px] tracking-wider font-extrabold text-brand-muted uppercase">
                            Proposed Ingredients ({meal.ingredients.length})
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {meal.ingredients.map((ing, idx) => (
                            <span
                              key={`${ing.ingredientName}-${idx}`}
                              className="rounded-full border border-brand-border/70 bg-brand-surface dark:bg-black/30 px-3 py-1.5 text-xs font-semibold text-brand-text shadow-2xs hover:border-brand-green/40 transition-colors"
                            >
                              {ing.ingredientName}
                              {ing.category ? (
                                <span className="ml-1 text-[10px] text-brand-muted font-normal">({ing.category})</span>
                              ) : null}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clinical Review Notice Banner */}
                    <div className="rounded-2xl border border-[#a64600]/30 bg-[#8c3b00]/10 p-4 flex items-start gap-3 text-xs text-brand-muted">
                      <ShieldAlert className="h-5 w-5 text-[#8c3b00] dark:text-[#ff8a3d] shrink-0 mt-0.5" />
                      <div className="leading-relaxed">
                        <strong className="text-brand-text block mb-0.5">Clinical Review in Progress</strong>
                        This recommendation is generated by KAINARA AI and is currently in preview while a PRC-licensed
                        nutritionist verifies it. Logging, meal swaps, and groceries become active once approved.
                      </div>
                    </div>

                    {/* Sticky Action Footer */}
                    <div className="sticky bottom-0 z-20 -mx-5 -mb-5 sm:-mx-7 sm:-mb-7 p-4 sm:p-5 bg-brand-surface/95 dark:bg-[#071914]/95 backdrop-blur-md border-t border-brand-border/80 shadow-lg mt-2 flex justify-end">
                      <Button
                        variant="secondary"
                        onClick={() => setIsOpen(false)}
                        className="text-xs font-bold px-6 py-2.5"
                      >
                        Close
                      </Button>
                    </div>
                  </MealMotionDiv>
                </MealMotionDiv>
              </div>
            )}
          </MealMotionPresence>,
          document.body
        )}
    </>
  );
}

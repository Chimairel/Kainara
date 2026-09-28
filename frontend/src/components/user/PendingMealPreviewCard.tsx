'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, Clock3, Coffee, MoonStar, ShieldAlert, SunMedium, Soup, Apple, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import MealImage from './MealImage';
import MealVerificationBadge from './MealVerificationBadge';
import { getMealTheme } from './MealCard';
import type { PublicMealImage, MealCookingLink } from '@/types';

export interface PendingMealPreview {
  mealName: string;
  mealType: string;
  description: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  scheduledDate: string;
  ingredients: { ingredientName: string; category: string }[];
  image?: PublicMealImage | null;
  cookingLink?: MealCookingLink | null;
  planType?: 'STARTER' | 'WEEKLY';
}

export default function PendingMealPreviewCard({
  meal,
  index = 0,
}: {
  meal: PendingMealPreview;
  index?: number;
}) {
  const theme = getMealTheme(meal.mealType, index);
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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

  return (
    <>
      <motion.div
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
        aria-label={`Open ${meal.mealName} details`}
        className="group relative block h-full w-full cursor-pointer select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg pt-12 sm:pt-14"
      >
        <div
          className={`relative flex h-full flex-col justify-between rounded-3xl border p-5 pt-16 sm:pt-20 transition-all duration-300 hover:-translate-y-1 ${theme.cardBg} ${theme.borderColor} ${theme.shadow} ${theme.hoverShadow}`}
        >
          {/* Circular Overhanging Dish at Top Center */}
          <div
            className={`absolute -top-12 sm:-top-14 left-1/2 -translate-x-1/2 h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-full p-1.5 sm:p-2 bg-white dark:bg-[#12362c] shadow-[0_16px_36px_-6px_rgba(0,0,0,0.28),0_4px_12px_rgba(0,0,0,0.12)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.7)] ${theme.plateRim} z-20 transition-transform duration-300 group-hover:scale-105`}
          >
            <div className="relative h-full w-full rounded-full overflow-hidden">
              <MealImage
                image={meal.image}
                mealName={meal.mealName}
                mealType={meal.mealType}
                className="!rounded-full !border-0 h-full w-full object-cover"
                variant="thumbnail"
                hideRepresentativeBadge
                ingredients={meal.ingredients}
              />
            </div>
          </div>

          {/* Card Top: Meal Type & Verification/Preview Badges */}
          <div className="flex items-center justify-between gap-2 mb-2 w-full">
            <div className="flex items-center gap-1.5 text-white/80">
              <MealTypeIcon className="h-3.5 w-3.5" />
              <span className="text-[11px] font-extrabold tracking-wider uppercase">
                {typeStyle.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <MealVerificationBadge status="PENDING_REVIEW" className="scale-90" />
              <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/25 px-2.5 py-0.5 font-mono text-[9px] font-medium text-white backdrop-blur-md">
                <Clock3 className="h-2.5 w-2.5 text-amber-300" /> Preview
              </span>
            </div>
          </div>

          {/* Card Center: Meal Name & Nutrition */}
          <div className="flex-1 flex flex-col justify-between my-2 text-center w-full">
            <h3 className="text-base sm:text-lg font-bold font-display tracking-tight leading-snug text-white line-clamp-2">
              {meal.mealName}
            </h3>

            <div className="mt-2 text-xs font-semibold text-white/90">
              <strong className="text-white font-extrabold">{Math.round(meal.calories)} kcal</strong> · {Math.round(meal.proteinG)}g P · {Math.round(meal.carbsG)}g C · {Math.round(meal.fatG)}g F
            </div>
          </div>

          {/* Enhanced Action Pill Button at bottom */}
          <div className="mt-4 flex w-full items-center justify-center">
            <span className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-white px-5 py-2 text-xs font-bold text-gray-900 shadow-md group-hover:bg-white/95 group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all duration-200">
              <span>Preview details</span>
              <span className="text-gray-400 group-hover:translate-x-0.5 transition-transform">&rarr;</span>
            </span>
          </div>
        </div>
      </motion.div>

      {/* Expandable Modal Dialog using Watermelon Expandable-Card Animation Pattern */}
      {isMounted &&
        createPortal(
          <AnimatePresence>
            {isOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
                {/* Backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsOpen(false)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-md"
                />

                {/* Expanded Modal Card */}
                <motion.div
                  layoutId={layoutId}
                  className="relative z-10 my-auto w-full max-w-2xl overflow-hidden rounded-3xl border border-brand-border/80 bg-brand-surface shadow-2xl max-h-[92vh] flex flex-col text-left select-none"
                >
                  {/* Floating Close Button */}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="absolute top-4 right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/20 dark:border-[#173e33] bg-[#071914]/80 text-white backdrop-blur-md hover:bg-[#071914] hover:border-emerald-500/40 transition-colors shadow-lg"
                    aria-label="Close modal"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Hero Image Container */}
                  <div className="relative h-52 sm:h-64 w-full shrink-0 overflow-hidden">
                    <motion.div layoutId={`image-wrap-${layoutId}`} className="h-full w-full">
                      <MealImage
                        image={meal.image}
                        mealName={meal.mealName}
                        mealType={meal.mealType}
                        className="h-full w-full rounded-none"
                        variant="hero"
                        ingredients={meal.ingredients}
                      />
                    </motion.div>
                    <MealVerificationBadge status="PENDING_REVIEW" className="absolute top-4 left-4 z-10" />
                  </div>

                  {/* Modal Body */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-5 sm:p-7 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-5"
                  >
                    {/* Title & Metadata */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <MealTypeIcon className={`h-4 w-4 ${typeStyle.iconClassName}`} />
                          <span className="text-xs font-extrabold uppercase tracking-wider text-brand-muted">
                            {typeStyle.label}
                          </span>
                          <span className="text-xs text-brand-muted">·</span>
                          <span className="flex items-center gap-1 text-xs font-semibold text-brand-muted">
                            <CalendarDays className="h-3 w-3" />
                            {scheduledDate}
                          </span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black font-display text-brand-text tracking-tight">
                          {meal.mealName}
                        </h3>
                      </div>
                    </div>

                    {meal.description && (
                      <p className="text-xs sm:text-sm text-brand-muted leading-relaxed">{meal.description}</p>
                    )}
                    {meal.cookingLink && (
                      <a
                        href={meal.cookingLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand-green underline"
                      >
                        {meal.cookingLink.kind === 'PANLASANG_RECIPE'
                          ? 'View original Panlasang Pinoy recipe ↗'
                          : 'Watch original cooking video ↗'}
                      </a>
                    )}
                    {meal.image?.attribution.sourcePageUrl && (
                      <a
                        href={meal.image.attribution.sourcePageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-brand-green underline"
                      >
                        View image source
                      </a>
                    )}

                    {/* Energy & Macro Breakdown Box */}
                    <div className="rounded-2xl border border-brand-border/60 bg-brand-bgAlt/55 p-4">
                      <div className="flex items-end justify-between gap-3 border-b border-brand-border/50 pb-3">
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-wider text-brand-muted">
                            Estimated energy
                          </p>
                          <p className="mt-1 font-display text-2xl font-black leading-none text-brand-text">
                            {Math.round(meal.calories)}
                            <span className="ml-1 text-xs font-bold uppercase tracking-wider text-brand-muted">
                              kcal
                            </span>
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-amber-400">
                          <Clock3 className="h-4 w-4" />
                          Awaiting RND review
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-3">
                        <div
                          className="rounded-xl border p-2.5 text-center"
                          style={{
                            backgroundColor: 'var(--macro-protein-bg)',
                            borderColor: 'var(--macro-protein-border)',
                          }}
                        >
                          <span
                            className="block font-display text-base font-black"
                            style={{ color: 'var(--macro-protein)' }}
                          >
                            {Math.round(meal.proteinG)}g
                          </span>
                          <span className="mt-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                            Protein
                          </span>
                        </div>
                        <div
                          className="rounded-xl border p-2.5 text-center"
                          style={{ backgroundColor: 'var(--macro-carbs-bg)', borderColor: 'var(--macro-carbs-border)' }}
                        >
                          <span
                            className="block font-display text-base font-black"
                            style={{ color: 'var(--macro-carbs)' }}
                          >
                            {Math.round(meal.carbsG)}g
                          </span>
                          <span className="mt-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                            Carbs
                          </span>
                        </div>
                        <div
                          className="rounded-xl border p-2.5 text-center"
                          style={{ backgroundColor: 'var(--macro-fat-bg)', borderColor: 'var(--macro-fat-border)' }}
                        >
                          <span
                            className="block font-display text-base font-black"
                            style={{ color: 'var(--macro-fat)' }}
                          >
                            {Math.round(meal.fatG)}g
                          </span>
                          <span className="mt-0.5 block text-[9px] font-extrabold uppercase tracking-wider text-brand-muted">
                            Fat
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Proposed Ingredients */}
                    {meal.ingredients && meal.ingredients.length > 0 && (
                      <div>
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-brand-muted mb-2.5">
                          Proposed Ingredients ({meal.ingredients.length})
                        </h4>
                        <div className="flex flex-wrap gap-1.5">
                          {meal.ingredients.map((ing, idx) => (
                            <span
                              key={`${ing.ingredientName}-${idx}`}
                              className="rounded-full border border-brand-border/70 bg-brand-surface px-3 py-1 text-xs font-semibold text-brand-text"
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

                    <div className="mt-2 flex justify-end">
                      <Button variant="secondary" onClick={() => setIsOpen(false)} className="text-xs font-bold px-5">
                        Close
                      </Button>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { CalendarDays, Clock3, Coffee, MoonStar, ShieldAlert, SunMedium, Soup, Apple, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import MealImage from './MealImage';
import MealVerificationBadge from './MealVerificationBadge';
import { getMealBannerTheme } from './MealCard';
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
  const bannerTheme = getMealBannerTheme(meal.mealType, index);
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
        className="group relative block h-full w-full cursor-pointer select-none text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-green focus-visible:ring-offset-2 focus-visible:ring-offset-brand-bg rounded-3xl"
      >
        <div className={`relative flex h-full flex-col justify-between rounded-3xl bg-brand-surface p-2 sm:p-2.5 ${bannerTheme.shadow} ${bannerTheme.hoverShadow} transition-all duration-300 hover:-translate-y-1`}>
          {/* Upper Banner with Cropped Circular Plate on Left */}
          <div className={`relative h-40 sm:h-44 w-full overflow-hidden rounded-2xl ${bannerTheme.bannerBg}`}>
            {/* Circular Plate on Left - Enlarge and crop so parts cut out */}
            <div className={`absolute -left-9 sm:-left-12 top-1/2 -translate-y-1/2 h-52 w-52 sm:h-56 sm:w-56 rounded-full ${bannerTheme.plateBorder} bg-white dark:bg-[#071914] shadow-[0_12px_28px_rgba(0,0,0,0.22)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.7)] overflow-hidden transition-transform duration-300 group-hover:scale-105`}>
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

            {/* Top Right Badges */}
            <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1.5 z-10">
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
            </div>
          </div>

          {/* Lower Details: Title, Description, and Colorful Macro Pills */}
          <div className="flex-1 flex flex-col justify-between p-2 pt-2.5">
            <div>
              <h3 className="text-base font-bold font-display tracking-tight text-brand-text leading-snug line-clamp-1">
                {meal.mealName}
              </h3>
              <p className="text-xs text-brand-muted line-clamp-1 mt-0.5">
                {meal.description || (meal.ingredients.length > 0 ? meal.ingredients.slice(0, 3).map((i) => i.ingredientName).join(', ') : 'AI candidate awaiting clinical review')}
              </p>
            </div>

            {/* Macro Chips Row - Theme Colors */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.04] dark:bg-white/[0.06] px-2.5 py-1 text-[11px] font-bold text-brand-text border border-black/10 dark:border-white/10">
                <span className="text-[10px]">🔥</span> {Math.round(meal.calories)} kcal
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#08705b]/10 dark:bg-[#10b981]/15 px-2.5 py-1 text-[11px] font-bold text-[#08705b] dark:text-[#34d399] border border-[#08705b]/20 dark:border-[#10b981]/30">
                {Math.round(meal.proteinG)}g P
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#18b9d2]/10 dark:bg-[#38bdf8]/15 px-2.5 py-1 text-[11px] font-bold text-[#0b7788] dark:text-[#38bdf8] border border-[#18b9d2]/20 dark:border-[#38bdf8]/30">
                {Math.round(meal.carbsG)}g C
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eb6a38]/10 dark:bg-[#eb6a38]/15 px-2.5 py-1 text-[11px] font-bold text-[#c74614] dark:text-[#f09e6c] border border-[#eb6a38]/20 dark:border-[#eb6a38]/30">
                {Math.round(meal.fatG)}g F
              </span>
            </div>
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

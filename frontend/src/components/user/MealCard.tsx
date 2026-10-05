'use client';

import { PlanMealCardSurface } from '@/components/user/PlanMealCardSurface';
import { MealMacros } from '@/components/user/MealMacros';
import { formatMealTitle } from '@/lib/meal-title';
import { getManilaDateKey } from '@/lib/manila-date';
import { cookingAction } from '@/lib/meal-cooking-link';
import {
  AIConfidenceFlag,
  MealCookingLink,
  MealExplanation,
  MealPlanStatus,
  MealType,
  PublicMealImage,
  PublicVerifier,
} from '@/types';
import type { LucideProps } from 'lucide-react';
import {
  AlertCircle,
  Apple,
  Check,
  Clock3,
  Coffee,
  Flame,
  Info,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Sun,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import MealImage from './MealImage';
import MealVerificationBadge from './MealVerificationBadge';
import NutritionistCredentialModal, { maskPrcLicenseNumber } from './NutritionistCredentialModal';

interface Ingredient {
  id: string;
  ingredientName: string;
  category?: string;
}

interface MealLog {
  id: string;
  status: 'DONE' | 'SKIPPED' | 'PENDING';
  source?: string;
}

interface MealCardProps {
  id: string;
  mealName: string;
  mealType: MealType;
  description?: string;
  ricePortion?: string | null;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  status: MealPlanStatus;
  aiConfidenceFlag: AIConfidenceFlag;
  ingredients?: Ingredient[];
  mealLogs?: MealLog[];
  onStatusToggle?: (mealId: string, newStatus: 'DONE' | 'SKIPPED' | 'PENDING') => Promise<void>;
  onSwapClick?: (mealId: string) => void;
  scheduledDate?: string;
  cycleScope?: 'CURRENT' | 'UPCOMING';
  onCardClick?: () => void;
  verifier?: PublicVerifier | null;
  explanation?: MealExplanation;
  image?: PublicMealImage | null;
  cookingLink?: MealCookingLink | null;
  nutritionistNote?: string | null;
  reviewedAt?: string | Date | null;
  index?: number;
  defaultOpen?: boolean;
  onCloseModal?: () => void;
}

export default function MealCard({
  id,
  mealName,
  mealType,
  description,
  ricePortion,
  calories,
  proteinG,
  carbsG,
  fatG,
  status,
  ingredients = [],
  mealLogs = [],
  onStatusToggle,
  onSwapClick,
  scheduledDate,
  cycleScope,
  onCardClick,
  verifier,
  explanation,
  image,
  cookingLink,
  nutritionistNote,
  reviewedAt,
  index = 0,
  defaultOpen = false,
  onCloseModal,
}: MealCardProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isVerifierOpen, setIsVerifierOpen] = useState(false);
  const [verifierModalTab, setVerifierModalTab] = useState<'card' | 'notes'>('card');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const displayVerifier: PublicVerifier | null = verifier ?? null;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (defaultOpen) {
      setIsOpen(true);
    }
  }, [defaultOpen]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    onCloseModal?.();
  }, [onCloseModal]);

  const layoutId = `meal-card-${id || mealName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const cooking = cookingAction(mealName, cookingLink);

  // Keyboard escape listener and body scroll lock when expanded
  useEffect(() => {
    if (!isOpen && !isVerifierOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isVerifierOpen) {
          setIsVerifierOpen(false);
        } else {
          handleClose();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, isVerifierOpen, handleClose]);

  const scheduledDateKey = scheduledDate ? getManilaDateKey(scheduledDate) : getManilaDateKey();
  const todayKey = getManilaDateKey();
  const isPastDate = scheduledDateKey < todayKey;
  const isFutureDate = scheduledDateKey > todayKey || cycleScope === 'UPCOMING';

  // Check if past grace period (> 7 days)
  const isPastGracePeriod = React.useMemo(() => {
    if (!scheduledDate) return false;
    const diffDays = Math.floor(
      (new Date(`${getManilaDateKey()}T00:00:00+08:00`).getTime() -
        new Date(`${getManilaDateKey(scheduledDate)}T00:00:00+08:00`).getTime()) /
        86_400_000
    );
    return diffDays > 7;
  }, [scheduledDate]);

  // Check if meal is logged as DONE or SKIPPED
  const isCompleted = mealLogs.some((l) => l.status === 'DONE');
  const isSkipped = mealLogs.some((l) => l.status === 'SKIPPED');
  const isUnloggedPastMeal = isPastDate && !isCompleted && !isSkipped;
  const isLogged = isCompleted || isSkipped;

  const proteinKcal = proteinG * 4;
  const carbsKcal = carbsG * 4;
  const fatKcal = fatG * 9;
  const totalMacroKcal = proteinKcal + carbsKcal + fatKcal;
  const calBase = calories > 0 ? calories : totalMacroKcal > 0 ? totalMacroKcal : 1;
  const proteinPct = Math.min(100, Math.max(0, Math.round((proteinKcal / calBase) * 100)));
  const carbsPct = Math.min(100, Math.max(0, Math.round((carbsKcal / calBase) * 100)));
  const fatPct = Math.min(100, Math.max(0, Math.round((fatKcal / calBase) * 100)));

  const handleCheckedChange = async (checked: boolean) => {
    if (!onStatusToggle || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusToggle(id, checked ? 'DONE' : 'PENDING');
      setIsOpen(false);
    } catch (err) {
      console.error('[MealCard] Status toggle error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSkipMeal = async () => {
    if (!onStatusToggle || isUpdating) return;

    setIsUpdating(true);
    try {
      await onStatusToggle(id, 'SKIPPED');
      setIsOpen(false);
    } catch (err) {
      console.error('[MealCard] Skip meal error:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  const mealTypeLabels: Record<MealType, { label: string; icon: React.ComponentType<LucideProps> }> = {
    BREAKFAST: { label: 'Breakfast', icon: Coffee },
    LUNCH: { label: 'Lunch', icon: Sun },
    DINNER: { label: 'Dinner', icon: Moon },
    SNACK: { label: 'Snack', icon: Apple },
  };

  const activeLabel = mealTypeLabels[mealType];
  const Icon = activeLabel.icon;

  return (
    <>
      {/* Simplified Meal Card inside Grid with Expandable Motion */}
      <motion.div
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

            {/* Macro Chips Row - Theme Colors */}
            <MealMacros calories={calories} proteinG={proteinG} carbsG={carbsG} fatG={fatG} className="mt-3" />
          </div>
        </PlanMealCardSurface>
      </motion.div>

      {/* Detailed Info Dialog Popup Modal -> Expandable Card Animation Pattern */}
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
                  onClick={handleClose}
                  className="fixed inset-0 bg-black/80 backdrop-blur-xl"
                />

                {/* Expanded Modal Card */}
                <motion.div
                  layoutId={layoutId}
                  className="relative z-10 my-auto w-full max-w-2xl overflow-hidden rounded-[28px] sm:rounded-[32px] border border-white/20 dark:border-white/10 bg-brand-surface shadow-[0_25px_70px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.85)] max-h-[92vh] flex flex-col text-left select-none ring-1 ring-black/5 dark:ring-white/5"
                >
                  {/* Hero Image Container */}
                  <div className="relative h-[260px] sm:h-[300px] w-full shrink-0 overflow-hidden bg-black/40">
                    <motion.div layoutId={`image-wrap-${layoutId}`} className="h-full w-full">
                      <MealImage
                        image={image}
                        mealName={mealName}
                        mealType={mealType}
                        className="h-full w-full rounded-none object-cover"
                        variant="hero"
                        ingredients={ingredients}
                      />
                    </motion.div>

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
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Modal Body */}
                  <motion.div
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
                            {Math.round(carbsG)}g
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
                              <h4 className="text-xs sm:text-sm font-black font-display text-brand-text">
                                Why this meal?
                              </h4>
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
                                    {displayVerifier.name.endsWith('RND')
                                      ? displayVerifier.name
                                      : `${displayVerifier.name}, RND`}
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
                          <h5 className="text-xs sm:text-sm font-bold text-brand-text leading-tight">
                            Need cooking help?
                          </h5>
                          <p className="text-[11px] text-brand-muted mt-0.5 leading-snug line-clamp-1">
                            {cooking.description}
                          </p>
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
                          <strong>AI Estimation Warning</strong>: This plan is still pending verification by a licensed
                          Registered Nutritionist-Dietitian. Use with caution.
                        </span>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {displayVerifier && (
        <NutritionistCredentialModal
          isOpen={isVerifierOpen}
          onClose={() => setIsVerifierOpen(false)}
          verifier={displayVerifier}
          nutritionistNote={nutritionistNote}
          reviewedAt={reviewedAt}
          mealName={mealName}
          initialTab={verifierModalTab}
        />
      )}
    </>
  );
}

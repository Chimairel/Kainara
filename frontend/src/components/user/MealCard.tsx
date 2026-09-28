'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import Button from '@/components/ui/Button';
import { MealType, MealPlanStatus, AIConfidenceFlag, PublicVerifier, MealExplanation, PublicMealImage, MealCookingLink } from '@/types';
import { cookingAction } from '@/lib/meal-cooking-link';
import MealImage from './MealImage';
import MealVerificationBadge from './MealVerificationBadge';
import { getManilaDateKey } from '@/lib/manila-date';
import NutritionistCredentialModal, { maskPrcLicenseNumber } from './NutritionistCredentialModal';
import {
  Check,
  X,
  AlertCircle,
  Coffee,
  Sun,
  Moon,
  Apple,
  RefreshCw,
  ShieldCheck,
  ListChecks,
  Clock3,
  CalendarDays,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

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
}

export interface MealThemeConfig {
  cardBg: string;
  borderColor: string;
  shadow: string;
  hoverShadow: string;
  plateRim: string;
}

const THEMES: Record<string, MealThemeConfig> = {
  BREAKFAST: {
    cardBg: 'bg-gradient-to-br from-[#eb6a38] via-[#e25c28] to-[#c74614] dark:from-[#8d3210] dark:via-[#752609] dark:to-[#571b05]',
    borderColor: 'border-[#f27e50]/40 dark:border-[#a63e17]/50',
    shadow: 'shadow-[0_12px_28px_-6px_rgba(235,106,56,0.35),0_4px_12px_rgba(235,106,56,0.15)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.65)]',
    hoverShadow: 'hover:shadow-[0_16px_36px_-4px_rgba(235,106,56,0.45),0_6px_16px_rgba(235,106,56,0.2)] dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.8)]',
    plateRim: 'border-2 border-[#ffeedd] dark:border-[#963713]',
  },
  LUNCH: {
    cardBg: 'bg-gradient-to-br from-[#08705b] via-[#065e4c] to-[#044c3d] dark:from-[#083e33] dark:via-[#06332a] dark:to-[#04241d]',
    borderColor: 'border-[#129177]/40 dark:border-[#0e6351]/50',
    shadow: 'shadow-[0_12px_28px_-6px_rgba(8,112,91,0.35),0_4px_12px_rgba(8,112,91,0.15)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.65)]',
    hoverShadow: 'hover:shadow-[0_16px_36px_-4px_rgba(8,112,91,0.45),0_6px_16px_rgba(8,112,91,0.2)] dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.8)]',
    plateRim: 'border-2 border-[#e6f7f2] dark:border-[#0e6351]',
  },
  DINNER: {
    cardBg: 'bg-gradient-to-br from-[#4f46e5] via-[#4338ca] to-[#3730a3] dark:from-[#2e265c] dark:via-[#241e4a] dark:to-[#1a1538]',
    borderColor: 'border-[#6b6bf1]/40 dark:border-[#4f46e5]/50',
    shadow: 'shadow-[0_12px_28px_-6px_rgba(79,70,229,0.35),0_4px_12px_rgba(79,70,229,0.15)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.65)]',
    hoverShadow: 'hover:shadow-[0_16px_36px_-4px_rgba(79,70,229,0.45),0_6px_16px_rgba(79,70,229,0.2)] dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.8)]',
    plateRim: 'border-2 border-[#ede9fe] dark:border-[#4338ca]',
  },
  SNACK: {
    cardBg: 'bg-gradient-to-br from-[#db4d6d] via-[#c43b5b] to-[#a62a48] dark:from-[#6b1e32] dark:via-[#541626] dark:to-[#3e0f1b]',
    borderColor: 'border-[#ea6383]/40 dark:border-[#8b2b44]/50',
    shadow: 'shadow-[0_12px_28px_-6px_rgba(219,77,109,0.35),0_4px_12px_rgba(219,77,109,0.15)] dark:shadow-[0_14px_32px_rgba(0,0,0,0.65)]',
    hoverShadow: 'hover:shadow-[0_16px_36px_-4px_rgba(219,77,109,0.45),0_6px_16px_rgba(219,77,109,0.2)] dark:hover:shadow-[0_18px_40px_rgba(0,0,0,0.8)]',
    plateRim: 'border-2 border-[#ffe4e9] dark:border-[#8b2b44]',
  },
};

export function getMealTheme(mealType?: string, index = 0): MealThemeConfig {
  const norm = (mealType || '').toUpperCase();
  if (norm.includes('BREAKFAST')) return THEMES.BREAKFAST;
  if (norm.includes('LUNCH')) return THEMES.LUNCH;
  if (norm.includes('DINNER')) return THEMES.DINNER;
  if (norm.includes('SNACK')) return THEMES.SNACK;
  const list = [THEMES.BREAKFAST, THEMES.LUNCH, THEMES.DINNER, THEMES.SNACK];
  return list[index % list.length];
}

export default function MealCard({
  id,
  mealName,
  mealType,
  description,
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
}: MealCardProps) {
  const theme = getMealTheme(mealType, index);
  const [isOpen, setIsOpen] = useState(false);
  const [isVerifierOpen, setIsVerifierOpen] = useState(false);
  const [verifierModalTab, setVerifierModalTab] = useState<'card' | 'notes'>('card');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const layoutId = `meal-card-${id || mealName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const cooking = cookingAction(mealName, cookingLink);

  // Keyboard escape listener and body scroll lock when expanded
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
        aria-label={`Open ${mealName} details`}
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
                image={image}
                mealName={mealName}
                mealType={mealType}
                className="!rounded-full !border-0 h-full w-full object-cover"
                variant="thumbnail"
                hideRepresentativeBadge
                ingredients={ingredients}
              />
            </div>
          </div>

          {/* Card Top: Meal Type & Verification/Status Badges */}
          <div className="flex items-center justify-between gap-2 mb-2 w-full">
            <div className="flex items-center gap-1.5 text-white/80">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-[11px] font-extrabold tracking-wider uppercase">
                {activeLabel.label}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <MealVerificationBadge
                status={status}
                hasVerifier={Boolean(verifier)}
                className="scale-90"
              />
              {isCompleted && (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300/40 bg-emerald-500/35 px-2.5 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white backdrop-blur-md">
                  <Check className="h-2.5 w-2.5 stroke-[3]" /> Eaten
                </span>
              )}
              {isSkipped && (
                <span className="inline-flex items-center gap-1 rounded-full border border-rose-300/40 bg-rose-500/30 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-white backdrop-blur-md">
                  <X className="h-2.5 w-2.5 stroke-[2.5]" /> Skipped
                </span>
              )}
              {isUnloggedPastMeal && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/30 bg-black/40 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-amber-200 backdrop-blur-md">
                  <Clock3 className="h-2.5 w-2.5" /> Unlogged
                </span>
              )}
              {status === 'PENDING_REVIEW' && !isLogged && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/30 bg-black/25 px-2.5 py-0.5 font-mono text-[9px] font-medium text-white backdrop-blur-md">
                  <Clock3 className="h-2.5 w-2.5 text-amber-300" /> Preview
                </span>
              )}
            </div>
          </div>

          {/* Card Center: Meal Name & Nutrition */}
          <div className="flex-1 flex flex-col justify-between my-2 text-center w-full">
            <h3
              className={`text-base sm:text-lg font-bold font-display tracking-tight leading-snug text-white line-clamp-2 ${
                isCompleted ? 'line-through text-white/70' : ''
              }`}
            >
              {mealName}
            </h3>

            <div className="mt-2 text-xs font-semibold text-white/90">
              <strong className="text-white font-extrabold">{Math.round(calories)} kcal</strong> · {Math.round(proteinG)}g P · {Math.round(carbsG)}g C · {Math.round(fatG)}g F
            </div>
          </div>

          {/* Enhanced Action Pill Button at bottom */}
          <div className="mt-4 flex w-full items-center justify-center">
            <span className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full bg-white px-5 py-2 text-xs font-bold text-gray-900 shadow-md group-hover:bg-white/95 group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all duration-200">
              <span>{isCompleted ? '✓ Eaten' : 'View details'}</span>
              {!isCompleted && <span className="text-gray-400 group-hover:translate-x-0.5 transition-transform">&rarr;</span>}
            </span>
          </div>
        </div>
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
                    className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-emerald-500/20 dark:border-[#173e33] bg-[#071914]/80 text-white backdrop-blur-md hover:bg-[#071914] hover:border-emerald-500/40 transition-colors shadow-lg"
                    aria-label="Close modal"
                  >
                    <X className="h-4 w-4" />
                  </button>

                  {/* Hero Image Container */}
                  <div className="relative h-48 sm:h-64 w-full shrink-0 overflow-hidden">
                    <motion.div layoutId={`image-wrap-${layoutId}`} className="h-full w-full">
                      <MealImage
                        image={image}
                        mealName={mealName}
                        mealType={mealType}
                        className="h-full w-full rounded-none"
                        variant="hero"
                        ingredients={ingredients}
                      />
                    </motion.div>
                    <MealVerificationBadge
                      status={status}
                      hasVerifier={Boolean(verifier)}
                      className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10"
                    />
                  </div>

                  {/* Modal Body */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 flex flex-col gap-4 sm:gap-5"
                  >
                    {/* Header / Meta Row */}
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <Icon className="h-4 w-4 text-brand-green" />
                        <span className="text-xs font-extrabold uppercase tracking-wider text-brand-muted">
                          {activeLabel.label}
                        </span>
                        {scheduledDate && (
                          <>
                            <span className="text-xs text-brand-muted">·</span>
                            <span className="flex items-center gap-1 text-xs font-semibold text-brand-muted">
                              <CalendarDays className="h-3 w-3" />
                              {scheduledDate}
                            </span>
                          </>
                        )}
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black font-display text-brand-text tracking-tight leading-tight">
                        {mealName}
                      </h3>
                      <span className="text-xs font-bold text-brand-muted mt-1 block">
                        {Math.round(calories)} kcal Total Energy
                      </span>
                      {image?.attribution.sourcePageUrl && (
                        <a
                          href={image.attribution.sourcePageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-block text-xs font-semibold text-brand-green underline"
                        >
                          View image source
                        </a>
                      )}
                    </div>

                    {/* Macro Badges Grid */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                      <div
                        className="border rounded-2xl p-2.5 sm:p-3 text-center"
                        style={{
                          backgroundColor: 'var(--macro-protein-bg)',
                          borderColor: 'var(--macro-protein-border)',
                        }}
                      >
                        <span
                          className="block text-base font-extrabold font-display"
                          style={{ color: 'var(--macro-protein)' }}
                        >
                          {Math.round(proteinG)}g
                        </span>
                        <span
                          className="block text-[9px] uppercase font-bold mt-0.5"
                          style={{ color: 'var(--macro-protein)' }}
                        >
                          Protein
                        </span>
                      </div>

                      <div
                        className="border rounded-2xl p-2.5 sm:p-3 text-center"
                        style={{
                          backgroundColor: 'var(--macro-carbs-bg)',
                          borderColor: 'var(--macro-carbs-border)',
                        }}
                      >
                        <span
                          className="block text-base font-extrabold font-display"
                          style={{ color: 'var(--macro-carbs)' }}
                        >
                          {Math.round(carbsG)}g
                        </span>
                        <span
                          className="block text-[9px] uppercase font-bold mt-0.5"
                          style={{ color: 'var(--macro-carbs)' }}
                        >
                          Carbs
                        </span>
                      </div>

                      <div
                        className="border rounded-2xl p-2.5 sm:p-3 text-center"
                        style={{
                          backgroundColor: 'var(--macro-fat-bg)',
                          borderColor: 'var(--macro-fat-border)',
                        }}
                      >
                        <span
                          className="block text-base font-extrabold font-display"
                          style={{ color: 'var(--macro-fat)' }}
                        >
                          {Math.round(fatG)}g
                        </span>
                        <span
                          className="block text-[9px] uppercase font-bold mt-0.5"
                          style={{ color: 'var(--macro-fat)' }}
                        >
                          Fat
                        </span>
                      </div>
                    </div>

                    {/* Description Text */}
                    <p className="text-xs text-brand-muted leading-relaxed">
                      {description ||
                        'This meal is part of your AI generation plan. Check ingredients and follow the instructions to prepare it.'}
                    </p>

                    {explanation && (
                      <section
                        className="rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 p-4"
                        aria-label="Why this meal"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-xs font-extrabold text-brand-text">
                            <ListChecks className="h-4 w-4 text-brand-green" />
                            Why this meal?
                          </div>
                          {verifier && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand-green/10 px-2 py-0.5 text-[9px] font-extrabold text-brand-green border border-brand-green/20">
                              <ShieldCheck className="h-3 w-3" /> RND reviewed recipe or case
                            </span>
                          )}
                        </div>
                        <ul className="mt-3 space-y-2 text-[11px] leading-relaxed text-brand-muted">
                          {explanation.bullets.map((bullet) => {
                            const isReviewerBullet = verifier && bullet.toLowerCase().includes('reviewed by');
                            return (
                              <li key={bullet} className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 min-w-0">
                                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-green" />
                                  <span className="break-words">{bullet}</span>
                                </div>
                                {isReviewerBullet && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setVerifierModalTab('notes');
                                      setIsOpen(false);
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
                        {explanation.limitation && (
                          <p className="mt-3 border-t border-brand-border/60 pt-3 text-[10px] text-brand-muted">
                            {explanation.limitation}
                          </p>
                        )}
                      </section>
                    )}

                    {verifier && (
                      <button
                        type="button"
                        onClick={() => {
                          setVerifierModalTab('card');
                          setIsOpen(false);
                          setIsVerifierOpen(true);
                        }}
                        className="group relative flex w-full flex-col gap-2.5 rounded-2xl border border-brand-green/30 bg-gradient-to-br from-brand-green/[0.08] via-brand-green/[0.03] to-transparent p-3.5 text-left transition hover:border-brand-green/60 hover:shadow-sm"
                        aria-label={`View clinical credentials for ${verifier.name}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {verifier.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={verifier.image}
                                alt={verifier.name}
                                className="h-10 w-10 rounded-full object-cover border-2 border-brand-green/30 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-brand-green/15 border-2 border-brand-green/30 flex items-center justify-center text-brand-green font-display font-bold text-xs shrink-0">
                                {verifier.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .slice(0, 2)
                                  .join('')}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-display font-extrabold text-xs text-brand-text truncate">
                                  {verifier.name.endsWith('RND') ? verifier.name : `${verifier.name}, RND`}
                                </span>
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-brand-green/15 px-1.5 py-0.5 text-[9px] font-extrabold text-brand-green">
                                  <ShieldCheck className="h-3 w-3" /> PRC-Verified
                                </span>
                              </div>
                              <p className="text-[10px] text-brand-muted truncate">
                                {verifier.specialization || 'Clinical Dietetics & Nutrition'} •{' '}
                                {maskPrcLicenseNumber(verifier.prcLicenseNumber)}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-[11px] font-bold text-brand-green group-hover:translate-x-0.5 transition-transform flex items-center gap-1">
                            Credentials ↗
                          </span>
                        </div>

                        {nutritionistNote && (
                          <div className="rounded-xl bg-brand-bgAlt/80 border border-brand-border/60 px-2.5 py-1.5 text-[10px] text-brand-muted italic line-clamp-2">
                            <span className="font-bold not-italic text-brand-text mr-1">RND Note:</span>
                            &ldquo;{nutritionistNote}&rdquo;
                          </div>
                        )}
                      </button>
                    )}

                    {/* Prefer the original recipe source when the meal has one. */}
                    <div className="bg-red-500/5 border border-red-500/15 rounded-2xl p-4 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl shrink-0">{cookingLink?.kind === 'PANLASANG_RECIPE' ? '📖' : '📺'}</span>
                        <div>
                          <h5 className="text-xs font-bold text-brand-text leading-tight">Need cooking help?</h5>
                          <p className="text-[10px] text-brand-muted mt-1 leading-snug">
                            {cooking.description}
                          </p>
                        </div>
                      </div>
                      <a
                        href={cooking.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`px-4 py-2 text-white text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 shrink-0 select-none cursor-pointer outline-none ${cookingLink?.kind === 'PANLASANG_RECIPE' ? 'bg-brand-green hover:brightness-90' : 'bg-[#ff0000] hover:bg-[#cc0000]'}`}
                      >
                        {cooking.label}
                      </a>
                    </div>

                    {/* Ingredients list */}
                    {ingredients.length > 0 && (
                      <div>
                        <span className="text-[9px] tracking-wider font-extrabold text-brand-muted uppercase block mb-2">
                          Ingredients List
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ingredients.map((ing) => (
                            <span
                              key={ing.id}
                              className="text-[10px] bg-brand-bgAlt border border-brand-border/60 text-brand-text px-2.5 py-1.5 rounded-lg leading-none font-semibold"
                            >
                              {ing.ingredientName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Clinical Warning Banner (Legal layer 3 & 4) */}
                    {status === 'PENDING_REVIEW' && (
                      <div className="p-3 rounded-xl bg-status-pending-bg/10 border border-status-pending-text/30 text-status-pending-text text-[10px] font-semibold leading-relaxed flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>
                          <strong>AI Estimation Warning</strong>: This plan is still pending verification by a licensed
                          Registered Nutritionist-Dietitian. Use with caution.
                        </span>
                      </div>
                    )}

                    {/* Action Buttons Panel */}
                    <div className="border-t border-brand-border/60 pt-4 mt-1">
                      {isUnloggedPastMeal && !isPastGracePeriod && (
                        <div className="mb-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-300 font-semibold flex items-center gap-2">
                          <Clock3 className="h-4 w-4 shrink-0" />
                          <span>
                            Missed this meal? You can still catch up and record whether you ate or skipped it.
                          </span>
                        </div>
                      )}
                      {isPastGracePeriod && (
                        <div className="mb-3 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-[11px] text-red-600 dark:text-red-400 font-semibold flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 shrink-0" />
                          <span>The 7-day logging grace period for this scheduled meal has passed.</span>
                        </div>
                      )}
                      {isFutureDate && (
                        <p className="mb-3 text-xs text-brand-muted">
                          This meal can be viewed or swapped now. Record it on its scheduled date.
                        </p>
                      )}
                      {!isLogged ? (
                        <div className="flex flex-col gap-3">
                          {/* Primary: Mark as Eaten */}
                          <Button
                            variant="primary"
                            onClick={() => handleCheckedChange(true)}
                            disabled={isUpdating || isPastGracePeriod || isFutureDate}
                            className="w-full font-bold py-2.5 text-xs"
                          >
                            Mark as Eaten
                          </Button>

                          {/* Secondary: Swap and Skip side-by-side */}
                          <div className="flex gap-3">
                            {onSwapClick && (
                              <Button
                                variant="secondary"
                                onClick={() => {
                                  setIsOpen(false);
                                  onSwapClick(id);
                                }}
                                disabled={isPastDate}
                                className="flex-1 font-bold text-xs py-2 h-9 border-brand-border flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isPastDate ? 'Past scheduled meals cannot be swapped.' : undefined}
                              >
                                <RefreshCw className="h-3 w-3 animate-spin-hover" /> Swap Meal
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              onClick={handleSkipMeal}
                              disabled={isUpdating || isPastGracePeriod || isFutureDate}
                              className="flex-1 font-bold text-xs py-2 h-9 bg-red-500/10 border border-red-500/25 text-red-500 hover:bg-red-600 hover:text-white"
                            >
                              Skip Meal
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* If logged, show Reset Status button */
                        <Button
                          variant="secondary"
                          onClick={() => handleCheckedChange(false)}
                          disabled={isUpdating || isPastGracePeriod || isFutureDate}
                          className="w-full font-bold py-2.5 text-xs border-amber-500/30 text-amber-600 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50"
                        >
                          Reset Meal Status
                        </Button>
                      )}
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {verifier && (
        <NutritionistCredentialModal
          isOpen={isVerifierOpen}
          onClose={() => setIsVerifierOpen(false)}
          verifier={verifier}
          nutritionistNote={nutritionistNote}
          reviewedAt={reviewedAt}
          mealName={mealName}
          initialTab={verifierModalTab}
        />
      )}
    </>
  );
}

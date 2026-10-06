'use client';

import { getManilaDateKey } from '@/lib/manila-date';
import { cookingAction } from '@/lib/meal-cooking-link';
import { MealType, PublicVerifier } from '@/types';
import type { LucideProps } from 'lucide-react';
import { Apple, Coffee, Moon, Sun } from 'lucide-react';
import { useMealMotion } from '../../components/user/MealMotion';
import React, { useCallback, useEffect, useState } from 'react';

import { MealCardProps } from './MealCard.shared';
export function useMealCardModel({
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
}: Omit<MealCardProps, 'aiConfidenceFlag'>) {
  const animateMeal = useMealMotion();
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

  return {
    kind: 'ready' as const,
    animateMeal,
    layoutId,
    mealName,
    onCardClick,
    setIsOpen,
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
    isMounted,
    isOpen,
    handleClose,
    displayVerifier,
    handleCheckedChange,
    isUpdating,
    isPastGracePeriod,
    isFutureDate,
    onSwapClick,
    id,
    isPastDate,
    handleSkipMeal,
    isUnloggedPastMeal,
    proteinPct,
    carbsPct,
    fatPct,
    description,
    explanation,
    setVerifierModalTab,
    setIsVerifierOpen,
    nutritionistNote,
    cookingLink,
    cooking,
    isVerifierOpen,
    reviewedAt,
    verifierModalTab,
  };
}

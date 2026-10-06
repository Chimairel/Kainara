'use client';
import { formatMealTitle } from '@/lib/meal-title';
import { DashboardMealPlate } from '@/components/user/DashboardMealCardSurface';

import { useState } from 'react';

import MealImage from '@/components/user/MealImage';
import { getMealTheme } from '@/features/dashboard/DashboardMealRow';

import { MealHistoryCardProps } from './MealHistoryCard.shared';
export function useMealHistoryCardModel({
  log,
  onUpdateNotes,
  onEditOutsideItem,
  onVoidOutsideLog,
  onRequestOutsideReview,
  onReplyToOutsideReview,
  onObservedConsent,
  onObservedWithdraw,
  className = '',
}: MealHistoryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [noteInput, setNoteInput] = useState(log.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    portionGrams: '',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    reason: '',
  });
  const [markUnresolved, setMarkUnresolved] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [clarification, setClarification] = useState('');
  const [consentItemId, setConsentItemId] = useState<string | null>(null);
  const [shareImage, setShareImage] = useState(false);

  // Normalize mealType from log.mealType or guess from mealName
  const normalizedType = (log.mealType || '').toUpperCase();
  const mealType = normalizedType.includes('BREAKFAST')
    ? 'BREAKFAST'
    : normalizedType.includes('DINNER')
      ? 'DINNER'
      : normalizedType.includes('SNACK')
        ? 'SNACK'
        : 'LUNCH';

  const mealLabels: Record<string, string> = {
    BREAKFAST: 'Breakfast',
    LUNCH: 'Lunch',
    DINNER: 'Dinner',
    SNACK: 'Snack',
  };
  const mealLabel = mealLabels[mealType] || 'Meal';

  const theme = getMealTheme(mealType);

  const handleSaveNotes = async () => {
    if (!onUpdateNotes || isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await onUpdateNotes(log.id, noteInput.trim() ? noteInput.trim() : null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch {
      setSaveError('Failed to save note. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isDone = log.status === 'DONE';
  const isSkipped = log.status === 'SKIPPED';
  const isVoided = log.status === 'VOIDED';
  const deltaVal = log.calorieDelta;
  const hasDelta = deltaVal !== null && deltaVal !== undefined;

  const foodPlate = (
    <DashboardMealPlate
      className={`relative -ml-4 sm:-ml-6 md:-ml-7 h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 shrink-0 rounded-full p-1 sm:p-1.5 bg-white dark:bg-[#12362c] shadow-[0_10px_24px_-3px_rgba(0,0,0,0.22),0_3px_8px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_28px_rgba(0,0,0,0.65)] ${theme.plateRim} z-20 transition-transform duration-300 group-hover:scale-105`}
    >
      <MealImage
        mealName={formatMealTitle(log.mealName)}
        mealType={mealType}
        variant="thumbnail"
        hideRepresentativeBadge
        className="!rounded-full !border-0 h-full w-full object-cover"
      />
    </DashboardMealPlate>
  );

  return {
    kind: 'ready' as const,
    mealType,
    className,
    setIsExpanded,
    isExpanded,
    foodPlate,
    mealLabel,
    log,
    isSkipped,
    isVoided,
    isDone,
    hasDelta,
    deltaVal,
    onEditOutsideItem,
    setEditingItemId,
    setEditDraft,
    setMarkUnresolved,
    editingItemId,
    setIsChanging,
    setSaveError,
    editDraft,
    markUnresolved,
    isChanging,
    onReplyToOutsideReview,
    clarification,
    setClarification,
    onRequestOutsideReview,
    onObservedWithdraw,
    consentItemId,
    shareImage,
    setShareImage,
    onObservedConsent,
    setConsentItemId,
    onVoidOutsideLog,
    voidReason,
    setVoidReason,
    noteInput,
    setNoteInput,
    saveError,
    saveSuccess,
    handleSaveNotes,
    isSaving,
  };
}

'use client';

import { MealMotionDiv, MealMotionPresence } from './MealMotion';

import { createPortal } from 'react-dom';

import NutritionistCredentialModal from './NutritionistCredentialModal';
import { MealCardProps } from '@/features/meal-card/MealCard.shared';

import { useMealCardModel } from '@/features/meal-card/useMealCardModel';
import MealCardTile from '@/features/meal-card/MealCardTile';
import MealCardModalHeader from '@/features/meal-card/MealCardModalHeader';
import MealCardModalBody from '@/features/meal-card/MealCardModalBody';
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
  const model = useMealCardModel({
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
    ingredients,
    mealLogs,
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
    index,
    defaultOpen,
    onCloseModal,
  });

  const {
    animateMeal,
    layoutId,
    isMounted,
    isOpen,
    handleClose,
    displayVerifier,
    setIsVerifierOpen,
    isVerifierOpen,
    verifierModalTab,
  } = model;
  return (
    <>
      {/* Simplified Meal Card inside Grid with Expandable Motion */}
      <MealCardTile model={model} />

      {/* Detailed Info Dialog Popup Modal -> Expandable Card Animation Pattern */}
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
                  onClick={handleClose}
                  className="fixed inset-0 bg-black/80 md:backdrop-blur-xl"
                />

                {/* Expanded Modal Card */}
                <MealMotionDiv
                  enabled={animateMeal}
                  layoutId={layoutId}
                  className="relative z-10 my-auto w-full max-w-2xl overflow-hidden rounded-[28px] sm:rounded-[32px] border border-white/20 dark:border-white/10 bg-brand-surface shadow-[0_25px_70px_rgba(0,0,0,0.45)] dark:shadow-[0_25px_80px_rgba(0,0,0,0.85)] max-h-[92vh] flex flex-col text-left select-none ring-1 ring-black/5 dark:ring-white/5"
                >
                  {/* Hero Image Container */}
                  <MealCardModalHeader model={model} />

                  {/* Modal Body */}
                  <MealCardModalBody model={model} />
                </MealMotionDiv>
              </div>
            )}
          </MealMotionPresence>,
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

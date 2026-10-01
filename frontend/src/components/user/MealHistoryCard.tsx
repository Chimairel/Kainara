'use client';

import React, { useState } from 'react';
import { Check, ChevronDown, FileText, Loader2, Save, X } from 'lucide-react';
import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';
import MealImage from '@/components/user/MealImage';
import { getMealTheme } from '@/features/dashboard/DashboardMealRow';
import api from '@/lib/axios';

interface MealHistoryCardProps {
  log: MealHistoryLog;
  onUpdateNotes?: (logId: string, notes: string | null) => Promise<void>;
  onEditOutsideItem?: (
    logId: string,
    itemId: string,
    input: {
      name: string;
      portionGrams: number | null;
      reportedNutrition?: { calories: number; proteinG: number; carbsG: number; fatG: number };
      unresolved?: boolean;
      reason: string;
    }
  ) => Promise<void>;
  onVoidOutsideLog?: (logId: string, reason: string) => Promise<void>;
  onRequestOutsideReview?: (logId: string, itemId: string) => Promise<void>;
  onReplyToOutsideReview?: (logId: string, itemId: string, message: string) => Promise<void>;
  onObservedConsent?: (logId: string, itemId: string, imageReuseConsent: boolean) => Promise<void>;
  onObservedWithdraw?: (submissionId: string) => Promise<void>;
  className?: string;
}

export default function MealHistoryCard({
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
    <div
      className={`relative -ml-9 sm:-ml-13 lg:-ml-16 h-28 w-28 sm:h-32 sm:w-32 lg:h-36 lg:w-36 shrink-0 rounded-full p-1.5 sm:p-2 bg-white dark:bg-[#12362c] shadow-[0_14px_32px_-4px_rgba(0,0,0,0.25),0_4px_12px_rgba(0,0,0,0.1)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.7)] ${theme.plateRim} z-20 transition-transform duration-300 group-hover:scale-105`}
    >
      <div className="relative h-full w-full rounded-full overflow-hidden">
        <MealImage
          mealName={log.mealName}
          mealType={mealType}
          variant="thumbnail"
          hideRepresentativeBadge
          className="!rounded-full !border-0 h-full w-full object-cover"
        />
      </div>
    </div>
  );

  return (
    <article
      className={`dashboard-meal group relative overflow-visible p-4 sm:p-5 ${theme.cardBg} ${theme.borderColor} ${theme.shadow} ${theme.hoverShadow} ${className}`}
    >
      {/* Primary Card Row */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
        aria-expanded={isExpanded}
        className="flex w-full cursor-pointer items-center justify-between text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-xl"
      >
        <div className="flex min-w-0 flex-1 items-center">
          {foodPlate}
          <div className="min-w-0 flex-1 pl-3 sm:pl-4">
            {/* Top Label & Source Badges */}
            <div className="flex items-center gap-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-white/80">
                {mealLabel}
              </span>
              {log.source === 'SYSTEM_GENERATED' && (
                <span className="rounded-full bg-white/20 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-white backdrop-blur-sm border border-white/20">
                  KAINARA
                </span>
              )}
              {log.source === 'USER_LOGGED' && (
                <span className="rounded-full bg-amber-400/25 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-amber-200 backdrop-blur-sm border border-amber-300/30">
                  Outside Meal
                </span>
              )}
              {log.source === 'USER_SWAPPED' && (
                <span className="rounded-full bg-sky-400/25 px-2 py-0.5 font-mono text-[9px] font-extrabold uppercase tracking-wider text-sky-200 backdrop-blur-sm border border-sky-300/30">
                  Swapped
                </span>
              )}
            </div>

            {/* Meal Title */}
            <h4
              className={`mt-0.5 block font-display text-base font-bold leading-snug text-white sm:text-lg line-clamp-2 ${
                isSkipped || isVoided ? 'line-through text-white/60' : ''
              }`}
            >
              {log.mealName}
            </h4>

            {/* Macro Line */}
            <span className="mt-1 block text-xs font-medium text-white/90">
              <span className="font-bold text-white">{Math.round(log.calories)} kcal</span>
              <span className="mx-1.5">·</span>
              <span className="font-bold text-white">{Math.round(log.proteinG)}g protein</span>
              <span className="mx-1.5">·</span>
              <span className="font-bold text-white">{Math.round(log.carbsG ?? 0)}g carbs</span>
              <span className="mx-1.5">·</span>
              <span className="font-bold text-white">{Math.round(log.fatG ?? 0)}g fat</span>
            </span>

            {/* Subtext / Notes preview */}
            <div className="mt-1 flex items-center gap-2 text-[11px] text-white/80">
              {log.notes ? (
                <span className="flex items-center gap-1 font-medium text-amber-200">
                  <FileText className="h-3 w-3 shrink-0" />
                  <span className="truncate max-w-[200px] sm:max-w-md italic">&ldquo;{log.notes}&rdquo;</span>
                </span>
              ) : (
                <span className="font-medium text-white/70 hover:underline">
                  {isDone ? 'Add notes to this meal' : 'View meal details'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right side controls: Status badge at top, Details button at bottom */}
        <div className="ml-3 flex shrink-0 flex-col items-end justify-between gap-3 self-stretch py-0.5">
          <div className="flex items-center gap-2">
            {hasDelta && log.source === 'USER_SWAPPED' && (
              <span
                className={`hidden sm:inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold border backdrop-blur-md ${
                  deltaVal > 0
                    ? 'border-amber-300/30 bg-amber-400/25 text-amber-100'
                    : 'border-white/30 bg-white/20 text-white'
                }`}
              >
                {deltaVal > 0 ? `+${Math.round(deltaVal)}` : Math.round(deltaVal)} kcal
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide backdrop-blur-md border shadow-xs ${
                isDone
                  ? 'border-emerald-300/40 bg-emerald-500/35 text-white'
                  : isSkipped
                    ? 'border-white/20 bg-black/30 text-white/80'
                    : isVoided
                      ? 'border-rose-400/30 bg-rose-900/40 text-rose-200'
                      : 'border-white/20 bg-black/25 text-white/90'
              }`}
            >
              {isDone ? (
                <>
                  <Check className="h-2.5 w-2.5 stroke-[3] text-emerald-300" />
                  <span>DONE</span>
                </>
              ) : isSkipped ? (
                <>
                  <X className="h-2.5 w-2.5 stroke-[3] text-white/70" />
                  <span>SKIPPED</span>
                </>
              ) : isVoided ? (
                <>
                  <X className="h-2.5 w-2.5 stroke-[3] text-rose-300" />
                  <span>VOIDED</span>
                </>
              ) : (
                <span>{log.status}</span>
              )}
            </span>
          </div>

          <span className="inline-flex min-h-8 sm:min-h-9 items-center gap-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white px-3 sm:px-3.5 py-1 text-xs font-bold backdrop-blur-md border border-white/30 shadow-xs transition-all duration-200">
            <span>{isExpanded ? 'Hide details' : 'Details'}</span>
            <ChevronDown
              className={`h-3.5 w-3.5 stroke-[2.5] transition-transform duration-200 ${
                isExpanded ? 'rotate-180' : ''
              }`}
            />
          </span>
        </div>
      </div>

      {/* Expandable Drawer: Notes & Detailed Breakdown */}
      {isExpanded && (
        <div className="mt-3.5 pl-0 sm:pl-3">
          <div className="rounded-2xl bg-black/35 backdrop-blur-md p-4 sm:p-5 text-white border border-white/20 shadow-inner space-y-4">
            {/* Macros Detailed Strip */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-sm">
                <span className="font-mono text-[9px] text-white/70 uppercase tracking-wider block">Calories</span>
                <span className="font-display font-extrabold text-white sm:text-base">
                  {Math.round(log.calories)} kcal
                </span>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-sm">
                <span className="font-mono text-[9px] text-emerald-200 uppercase tracking-wider block">Protein</span>
                <span className="font-display font-extrabold text-emerald-300 sm:text-base">
                  {Math.round(log.proteinG)}g
                </span>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-sm">
                <span className="font-mono text-[9px] text-amber-200 uppercase tracking-wider block">Carbs</span>
                <span className="font-display font-extrabold text-amber-300 sm:text-base">
                  {Math.round(log.carbsG)}g
                </span>
              </div>
              <div className="rounded-xl border border-white/15 bg-white/10 p-2.5 backdrop-blur-sm">
                <span className="font-mono text-[9px] text-rose-200 uppercase tracking-wider block">Fat</span>
                <span className="font-display font-extrabold text-rose-300 sm:text-base">
                  {Math.round(log.fatG)}g
                </span>
              </div>
            </div>

            {/* Outside Items list if available */}
            {log.outsideItems && log.outsideItems.length > 0 && (
              <div className="rounded-xl border border-white/15 bg-white/10 p-3.5 text-xs text-white backdrop-blur-sm">
                <p className="font-bold text-white/80 uppercase tracking-wider text-[10px] mb-1.5">
                  Logged Food Items
                </p>
                {log.nutritionCompleteness && log.nutritionCompleteness !== 'COMPLETE' && (
                  <p className="mb-2 text-white/80">
                    Partial total: unresolved items are excluded, not counted as zero.
                  </p>
                )}
                {log.provisionalCalories ? (
                  <p className="mb-2 text-amber-300">{Math.round(log.provisionalCalories)} kcal remains estimated.</p>
                ) : null}
                <div className="space-y-2">
                  {log.outsideItems.map((item, idx) => (
                    <div
                      key={`${item.name}-${idx}`}
                      className="rounded-lg border border-white/15 bg-black/25 p-2.5 text-xs text-white"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span>
                          {item.name}
                          {item.portionGrams ? ` (${item.portionGrams}g)` : ''} ·{' '}
                          {item.includedInTotals ? `${Math.round(item.calories ?? 0)} kcal` : 'Unresolved'} ·{' '}
                          {item.source?.replaceAll('_', ' ').toLowerCase()} · revision {item.currentRevision ?? 0}
                        </span>
                        {log.source === 'USER_LOGGED' && !isVoided && onEditOutsideItem && (
                          <button
                            type="button"
                            className="text-emerald-300 underline font-medium hover:text-emerald-200"
                            onClick={() => {
                              setEditingItemId(item.id);
                              setEditDraft({
                                name: item.name,
                                portionGrams: String(item.portionGrams ?? ''),
                                calories: String(item.calories ?? ''),
                                proteinG: String(item.proteinG ?? ''),
                                carbsG: String(item.carbsG ?? ''),
                                fatG: String(item.fatG ?? ''),
                                reason: '',
                              });
                              setMarkUnresolved(!item.includedInTotals);
                            }}
                          >
                            Correct
                          </button>
                        )}
                      </div>
                      {editingItemId === item.id && (
                        <form
                          className="mt-3 grid grid-cols-2 gap-2 text-gray-900"
                          onSubmit={async (event) => {
                            event.preventDefault();
                            if (!onEditOutsideItem) return;
                            setIsChanging(true);
                            setSaveError(null);
                            try {
                              await onEditOutsideItem(log.id, item.id, {
                                name: editDraft.name,
                                portionGrams: editDraft.portionGrams ? Number(editDraft.portionGrams) : null,
                                ...(markUnresolved
                                  ? { unresolved: true }
                                  : {
                                      reportedNutrition: {
                                        calories: Number(editDraft.calories),
                                        proteinG: Number(editDraft.proteinG),
                                        carbsG: Number(editDraft.carbsG),
                                        fatG: Number(editDraft.fatG),
                                      },
                                    }),
                                reason: editDraft.reason || 'User corrected this record',
                              });
                              setEditingItemId(null);
                            } catch {
                              setSaveError('Could not revise this item. Reload and try again.');
                            } finally {
                              setIsChanging(false);
                            }
                          }}
                        >
                          <input
                            className="col-span-2 rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                            aria-label="Corrected food name"
                            value={editDraft.name}
                            onChange={(event) => setEditDraft((draft) => ({ ...draft, name: event.target.value }))}
                            required
                          />
                          <input
                            className="rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                            type="number"
                            min="1"
                            max="5000"
                            step="0.1"
                            aria-label="Corrected portion grams"
                            placeholder="Portion g"
                            value={editDraft.portionGrams}
                            onChange={(event) =>
                              setEditDraft((draft) => ({ ...draft, portionGrams: event.target.value }))
                            }
                          />
                          <label className="flex items-center gap-1 text-xs text-white">
                            <input
                              type="checkbox"
                              checked={markUnresolved}
                              onChange={(event) => setMarkUnresolved(event.target.checked)}
                            />{' '}
                            Unknown nutrition
                          </label>
                          {!markUnresolved &&
                            (['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((field) => (
                              <input
                                key={field}
                                className="rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                                type="number"
                                min="0"
                                step="0.1"
                                required
                                aria-label={`Corrected ${field}`}
                                placeholder={field}
                                value={editDraft[field]}
                                onChange={(event) => setEditDraft((draft) => ({ ...draft, [field]: event.target.value }))}
                              />
                            ))}
                          <input
                            className="col-span-2 rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                            aria-label="Reason for correction"
                            placeholder="What changed?"
                            value={editDraft.reason}
                            onChange={(event) => setEditDraft((draft) => ({ ...draft, reason: event.target.value }))}
                          />
                          <button
                            disabled={isChanging}
                            className="rounded bg-emerald-500 hover:bg-emerald-400 p-2 font-bold text-black text-xs"
                            type="submit"
                          >
                            Save revision
                          </button>
                          <button
                            type="button"
                            className="text-xs text-white/80 hover:text-white"
                            onClick={() => setEditingItemId(null)}
                          >
                            Cancel
                          </button>
                        </form>
                      )}
                      {log.source === 'USER_LOGGED' && (
                        <div className="mt-2 space-y-2 border-t border-white/10 pt-2 text-white/90">
                          <p className="font-semibold text-white/80">
                            {item.review?.status === 'PENDING'
                              ? 'Queued for nutrition estimate review'
                              : item.review?.status === 'CLAIMED'
                                ? 'Nutrition estimate under review'
                                : item.review?.status === 'VERIFIED'
                                  ? 'Nutrition estimate confirmed'
                                  : item.review?.status === 'CORRECTED'
                                    ? 'Corrected and confirmed nutrition estimate'
                                    : item.review?.status === 'NEEDS_MORE_INFO'
                                      ? 'Nutritionist needs more information'
                                      : item.review?.status === 'UNVERIFIABLE'
                                        ? 'Estimate could not be confirmed; it remains estimated'
                                        : 'No nutritionist review requested'}
                          </p>
                          {item.review &&
                            ['VERIFIED', 'CORRECTED', 'UNVERIFIABLE'].includes(item.review.status) &&
                            item.revisions?.[0]?.revision === (item.review.reviewedRevision ?? -1) + 1 &&
                            item.revisions[0].reason && (
                              <p className="rounded-lg bg-black/20 p-2 text-white/80">
                                Nutritionist rationale: {item.revisions[0].reason}
                              </p>
                            )}
                          {item.review?.messages?.map((message) => (
                            <p key={message.id} className="rounded-lg bg-black/20 p-2 text-white/80">
                              <strong>{message.sender === 'NUTRITIONIST' ? 'Nutritionist' : 'You'}:</strong>{' '}
                              {message.content}
                              <span className="ml-2 text-[10px] text-white/60">Revision {message.itemRevision}</span>
                            </p>
                          ))}
                          {!isVoided && item.review?.status === 'NEEDS_MORE_INFO' && onReplyToOutsideReview && (
                            <form
                              className="space-y-2"
                              onSubmit={async (event) => {
                                event.preventDefault();
                                setIsChanging(true);
                                setSaveError(null);
                                try {
                                  await onReplyToOutsideReview(log.id, item.id, clarification.trim());
                                  setClarification('');
                                } catch {
                                  setSaveError('Could not send your clarification.');
                                } finally {
                                  setIsChanging(false);
                                }
                              }}
                            >
                              <textarea
                                className="w-full rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                                maxLength={1000}
                                value={clarification}
                                onChange={(event) => setClarification(event.target.value)}
                                placeholder="Answer the specific nutritionist question"
                                aria-label="Clarification reply"
                              />
                              <button
                                type="submit"
                                disabled={isChanging || clarification.trim().length < 3}
                                className="rounded bg-emerald-500 px-3 py-1 font-bold text-black text-xs disabled:opacity-50"
                              >
                                Send clarification
                              </button>
                            </form>
                          )}
                          {!isVoided &&
                            onRequestOutsideReview &&
                            (!item.review || ['VERIFIED', 'CORRECTED', 'UNVERIFIABLE'].includes(item.review.status)) && (
                              <button
                                type="button"
                                disabled={isChanging}
                                className="text-emerald-300 underline font-medium hover:text-emerald-200"
                                onClick={async () => {
                                  setIsChanging(true);
                                  setSaveError(null);
                                  try {
                                    await onRequestOutsideReview(log.id, item.id);
                                  } catch {
                                    setSaveError('Could not request estimate review.');
                                  } finally {
                                    setIsChanging(false);
                                  }
                                }}
                              >
                                {item.review ? 'Request another estimate review' : 'Request nutrition estimate review'}
                              </button>
                            )}
                          {!isVoided &&
                            ['VERIFIED', 'CORRECTED'].includes(item.review?.status ?? '') &&
                            item.portionGrams &&
                            item.portionGrams > 0 &&
                            (() => {
                              const submission = item.observedSubmissions?.find(
                                (row) => row.sourceRevision === item.currentRevision && row.status !== 'WITHDRAWN'
                              );
                              return submission ? (
                                <div className="text-xs text-white/80">
                                  <p>
                                    Deidentified food-detail reuse: {submission.status.replaceAll('_', ' ').toLowerCase()}
                                    . This does not certify a recipe or reuse your private notes.
                                  </p>
                                  {onObservedWithdraw && (
                                    <button
                                      type="button"
                                      className="text-emerald-300 underline hover:text-emerald-200"
                                      disabled={isChanging}
                                      onClick={async () => {
                                        setIsChanging(true);
                                        setSaveError(null);
                                        try {
                                          await onObservedWithdraw(submission.id);
                                        } catch {
                                          setSaveError('Could not withdraw reuse permission.');
                                        } finally {
                                          setIsChanging(false);
                                        }
                                      }}
                                    >
                                      Withdraw future reuse
                                    </button>
                                  )}
                                </div>
                              ) : consentItemId === item.id ? (
                                <div className="space-y-2 rounded-lg border border-white/20 bg-black/20 p-3 text-xs text-white">
                                  <p>
                                    Allow a nutritionist to turn this confirmed estimate into a deidentified food
                                    reference or recipe candidate. Your identity and private notes will not be shared.
                                    This is optional.
                                  </p>
                                  {log.hasImage && (
                                    <label className="flex items-start gap-2">
                                      <input
                                        type="checkbox"
                                        checked={shareImage}
                                        onChange={(event) => setShareImage(event.target.checked)}
                                      />
                                      I own this photo and separately allow its reuse. Photos are not currently copied
                                      into the shared corpus.
                                    </label>
                                  )}
                                  <div className="flex gap-3">
                                    <button
                                      type="button"
                                      disabled={isChanging}
                                      className="text-emerald-300 underline hover:text-emerald-200"
                                      onClick={async () => {
                                        if (!onObservedConsent) return;
                                        setIsChanging(true);
                                        setSaveError(null);
                                        try {
                                          await onObservedConsent(log.id, item.id, shareImage);
                                          setConsentItemId(null);
                                        } catch {
                                          setSaveError('Could not submit reuse permission.');
                                        } finally {
                                          setIsChanging(false);
                                        }
                                      }}
                                    >
                                      Allow deidentified details
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConsentItemId(null)}
                                      className="text-white/70 hover:text-white"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                onObservedConsent && (
                                  <button
                                    type="button"
                                    className="text-emerald-300 underline hover:text-emerald-200"
                                    onClick={() => {
                                      setShareImage(false);
                                      setConsentItemId(item.id);
                                    }}
                                  >
                                    Optionally share deidentified food details
                                  </button>
                                )
                              );
                            })()}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {log.source === 'USER_LOGGED' && log.hasImage && (
              <button
                type="button"
                className="text-xs text-emerald-300 hover:text-emerald-200 underline"
                onClick={async () => {
                  try {
                    const response = await api.get(`/user/meals/logs/${log.id}/image`, { responseType: 'blob' });
                    const url = URL.createObjectURL(response.data);
                    window.open(url, '_blank', 'noopener,noreferrer');
                    setTimeout(() => URL.revokeObjectURL(url), 60_000);
                  } catch {
                    setSaveError('Could not open the image.');
                  }
                }}
              >
                View attached photo
              </button>
            )}

            {log.source === 'USER_LOGGED' && !isVoided && onVoidOutsideLog && (
              <div className="rounded-xl border border-rose-400/30 bg-rose-950/30 p-3 text-xs text-white">
                <p className="font-bold text-rose-300">Remove this entry from active totals</p>
                <p className="mb-2 text-white/80">The original record and corrections remain in your history.</p>
                <input
                  className="w-full rounded border border-gray-300 bg-white p-2 text-xs text-gray-900"
                  aria-label="Reason for voiding"
                  placeholder="Reason for voiding this entry"
                  value={voidReason}
                  onChange={(event) => setVoidReason(event.target.value)}
                />
                <button
                  type="button"
                  disabled={isChanging || voidReason.trim().length < 3}
                  className="mt-2 rounded border border-rose-400 bg-rose-500/20 px-3 py-1 text-rose-200 hover:bg-rose-500/30 disabled:opacity-50"
                  onClick={async () => {
                    setIsChanging(true);
                    setSaveError(null);
                    try {
                      await onVoidOutsideLog(log.id, voidReason.trim());
                    } catch {
                      setSaveError('Could not void this entry.');
                    } finally {
                      setIsChanging(false);
                    }
                  }}
                >
                  Void outside meal
                </button>
              </div>
            )}

            {/* Note Editor Area */}
            <div className="rounded-xl border border-white/20 bg-black/25 p-4 shadow-sm backdrop-blur-sm">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor={`meal-note-${log.id}`}
                  className="flex items-center gap-1.5 font-display text-xs font-bold text-white"
                >
                  <FileText className="h-3.5 w-3.5 text-emerald-300" />
                  Personal Meal Notes
                </label>
                <span className="font-mono text-[10px] text-white/60">
                  {noteInput.length} / 1000
                </span>
              </div>

              <textarea
                id={`meal-note-${log.id}`}
                rows={2}
                maxLength={1000}
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Add personal note (e.g. portion adjustment, how you felt, substitutions made)..."
                className="w-full rounded-xl border border-white/20 bg-white/10 p-3 text-xs text-white placeholder:text-white/50 outline-none transition focus:border-white focus:bg-white/15 resize-none"
              />

              {saveError && <p className="mt-1 text-[11px] font-semibold text-rose-300">{saveError}</p>}

              <div className="mt-3 flex items-center justify-between">
                {saveSuccess ? (
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-300 animate-fadeIn">
                    <Check className="h-3.5 w-3.5 stroke-[3]" /> Note saved
                  </span>
                ) : (
                  <span className="text-[10px] text-white/60">
                    Notes are private to your personal timeline.
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleSaveNotes}
                  disabled={isSaving || noteInput === (log.notes || '')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/30 bg-white/20 hover:bg-white/30 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>Save Note</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

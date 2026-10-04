'use client';

import { useVisiblePolling } from '@/hooks/useVisiblePolling';
import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Apple,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Moon,
  Sun,
  Utensils,
} from 'lucide-react';
import api from '@/lib/axios';
import { getApiErrorMessage } from '@/lib/api-error';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/shared/EmptyState';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { useAuth } from '@/hooks/useAuth';
import { readSessionResource, writeSessionResource } from '@/lib/session-resource-cache';

type QueueRow = {
  id: string;
  priority: number;
  status: string;
  queueReason: string | null;
  claimedRevision: number | null;
  messages: Array<{
    id: string;
    sender: 'USER' | 'NUTRITIONIST';
    itemRevision: number;
    content: string;
    createdAt: string;
  }>;
  claimStatus: { claimedByMe: boolean; claimedByOther: boolean; claimedByName: string | null };
  outsideMealLogItem: {
    id: string;
    name: string;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    calorieLow: number | null;
    calorieHigh: number | null;
    compatibilityStatus: string;
    nutritionStatus: string;
    includedInTotals: boolean;
    currentRevision: number;
    ingredients: string[] | null;
    mealLog: {
      mealName: string;
      mealType: string | null;
      loggedAt: string;
      estimationContext?: string | null;
      outsideImageMime?: string | null;
    };
  };
};

type ObservedSubmission = {
  id: string;
  sourceRevision: number;
  createdAt: string;
  sourceOutsideMealItem: {
    name: string;
    portionGrams: number | null;
    calories: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    currentRevision: number;
    nutritionStatus: string;
    ingredients: unknown;
    mealLog: { mealType: string | null; estimationContext: string | null; status: string };
  } | null;
};

const emptyCorrection = { calories: '', proteinG: '', carbsG: '', fatG: '', reason: '' };
type OutsideQueues = { rows: QueueRow[]; submissions: ObservedSubmission[] };

function getMealTypeTheme(mealType?: string | null) {
  const norm = (mealType || '').toUpperCase();
  if (norm.includes('BREAKFAST')) {
    return {
      label: 'Breakfast',
      icon: Sun,
      badgeStyle: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
    };
  }
  if (norm.includes('LUNCH')) {
    return {
      label: 'Lunch',
      icon: Utensils,
      badgeStyle: 'border-brand-green/25 bg-brand-green/10 text-brand-green dark:text-emerald-400',
    };
  }
  if (norm.includes('DINNER')) {
    return {
      label: 'Dinner',
      icon: Moon,
      badgeStyle: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
    };
  }
  if (norm.includes('SNACK')) {
    return {
      label: 'Snack',
      icon: Apple,
      badgeStyle: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
    };
  }
  return {
    label: mealType || 'Meal',
    icon: Utensils,
    badgeStyle: 'border-brand-border/70 bg-brand-bgAlt text-brand-muted',
  };
}

export default function OutsideMealReviewsPanel({ embedded = false }: { embedded?: boolean } = {}) {
  const ownerId = useAuth().user?.userId;
  const cached = readSessionResource<OutsideQueues>(ownerId, 'nutritionist-outside-queues', 30_000);
  const [isLoading, setIsLoading] = useState(!cached);
  const [rows, setRows] = useState<QueueRow[]>(cached?.rows ?? []);
  const [selected, setSelected] = useState<QueueRow | null>(null);
  const [correction, setCorrection] = useState(emptyCorrection);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submissions, setSubmissions] = useState<ObservedSubmission[]>(cached?.submissions ?? []);
  const [observed, setObserved] = useState<ObservedSubmission | null>(null);
  const [observedKind, setObservedKind] = useState<'FOOD_REFERENCE' | 'RECIPE_CANDIDATE'>('FOOD_REFERENCE');
  const [canonicalName, setCanonicalName] = useState('');
  const [ingredientLines, setIngredientLines] = useState('');
  const [preparation, setPreparation] = useState('');
  const [applicableTypes, setApplicableTypes] = useState<string[]>([]);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setError(null);
      try {
        const [reviews, observations] = await Promise.all([
          api.get('/nutritionist/outside-meal-reviews', signal ? { signal } : undefined),
          api.get('/nutritionist/observed-meal-submissions', signal ? { signal } : undefined),
        ]);
        if (signal?.aborted) return;
        const next = { rows: reviews.data?.data ?? [], submissions: observations.data?.data ?? [] };
        setRows(next.rows);
        setSubmissions(next.submissions);
        writeSessionResource(ownerId, 'nutritionist-outside-queues', next);
      } catch (err) {
        if (!signal?.aborted) setError(getApiErrorMessage(err, 'Failed to load outside-meal reviews.'));
      } finally {
        setIsLoading(false);
      }
    },
    [ownerId]
  );

  useVisiblePolling(
    async (signal) => {
      await load(signal);
    },
    { enabled: !busy, immediate: false, scopeKey: ownerId }
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelected((current) => {
      const latest = rows.find((row) => row.id === current?.id);
      return current && latest ? { ...current, ...latest } : current;
    });
  }, [rows]);

  const claim = async (row: QueueRow) => {
    setBusy(true);
    setError(null);
    try {
      const response = await api.post(`/nutritionist/outside-meal-reviews/${row.id}/claim`);
      setSelected({
        ...response.data.data,
        claimStatus: { claimedByMe: true, claimedByOther: false, claimedByName: null },
      });
      setCorrection({
        calories: String(row.outsideMealLogItem.calories ?? ''),
        proteinG: String(row.outsideMealLogItem.proteinG ?? ''),
        carbsG: String(row.outsideMealLogItem.carbsG ?? ''),
        fatG: String(row.outsideMealLogItem.fatG ?? ''),
        reason: '',
      });
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not claim this review.'));
    } finally {
      setBusy(false);
    }
  };

  const resolve = async (action: 'VERIFY' | 'CORRECT' | 'NEEDS_MORE_INFO' | 'UNVERIFIABLE') => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/nutritionist/outside-meal-reviews/${selected.id}`, {
        action,
        reason: correction.reason,
        ...(action === 'CORRECT'
          ? {
              calories: Number(correction.calories),
              proteinG: Number(correction.proteinG),
              carbsG: Number(correction.carbsG),
              fatG: Number(correction.fatG),
            }
          : {}),
      });
      setSelected(null);
      setCorrection(emptyCorrection);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to submit the review.'));
    } finally {
      setBusy(false);
    }
  };

  const selectObserved = (row: ObservedSubmission) => {
    setObserved(row);
    setObservedKind('FOOD_REFERENCE');
    setCanonicalName(row.sourceOutsideMealItem?.name ?? '');
    const ingredients = row.sourceOutsideMealItem?.ingredients;
    setIngredientLines(
      Array.isArray(ingredients)
        ? ingredients
            .flatMap((item) => {
              if (!item || typeof item !== 'object' || !('name' in item)) return [];
              const ingredient = item as { name: string; quantity?: number; unit?: string };
              return [`${ingredient.name} | ${ingredient.quantity ?? ''} | ${ingredient.unit ?? ''}`];
            })
            .join('\n')
        : ''
    );
    setPreparation(row.sourceOutsideMealItem?.mealLog.estimationContext ?? '');
    setApplicableTypes(
      row.sourceOutsideMealItem?.mealLog.mealType &&
        ['BREAKFAST', 'LUNCH', 'DINNER'].includes(row.sourceOutsideMealItem.mealLog.mealType)
        ? [row.sourceOutsideMealItem.mealLog.mealType]
        : []
    );
  };

  const admitObserved = async () => {
    if (!observed) return;
    setBusy(true);
    setError(null);
    try {
      const ingredients = ingredientLines
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const [name, amount, unit] = line.split('|').map((part) => part.trim());
          return { name, quantity: Number(amount), unit };
        });
      await api.post(`/nutritionist/observed-meal-submissions/${observed.id}/admit`, {
        kind: observedKind,
        canonicalName: canonicalName.trim(),
        ...(observedKind === 'RECIPE_CANDIDATE'
          ? {
              ingredients,
              preparation: preparation.trim(),
              mealTypes: applicableTypes,
            }
          : {}),
      });
      setObserved(null);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not classify this observation.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {!embedded && (
        <PortalPageHeader
          icon={ClipboardCheck}
          eyebrow="Nutrition review"
          title="Outside food estimates"
          description="Confirm an intake estimate, correct it, ask for detail, or mark it unverifiable. This does not certify a reusable recipe."
        />
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-status-error-text/30 bg-status-error-bg/10 p-4 text-sm text-status-error-text">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] items-start">
        {/* Left Column: Outside Food Queue */}
        <div className="flex flex-col gap-3">
          {isLoading ? (
            <div className="space-y-3" aria-label="Loading outside food estimates">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="space-y-3 rounded-2xl border border-brand-border/70 bg-brand-surface p-4 sm:p-5 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1">
                      <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
                      <div className="space-y-1.5 flex-1">
                        <Skeleton className="h-4 w-44 rounded-md" />
                        <Skeleton className="h-3 w-28 rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Skeleton className="h-5 w-20 rounded-full" />
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-brand-border/40 pt-3">
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <Skeleton className="h-6 w-14 rounded-full" />
                    <Skeleton className="h-6 w-14 rounded-full" />
                    <Skeleton className="h-6 w-14 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              title="No outside-meal estimates waiting"
              description="Member requests and selected uncertain or conflicting entries will appear here."
            />
          ) : (
            rows.map((row) => {
              const theme = getMealTypeTheme(row.outsideMealLogItem.mealLog.mealType);
              const MealIcon = theme.icon;
              const isSelected = selected?.id === row.id;

              return (
                <button
                  key={row.id}
                  type="button"
                  disabled={row.claimStatus.claimedByOther || busy}
                  onClick={() => void claim(row)}
                  className={`group w-full text-left transition-all duration-200 outline-none ${
                    row.claimStatus.claimedByOther ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <div
                    className={`rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
                      isSelected
                        ? 'border-brand-green bg-brand-green/[0.05] shadow-md ring-1 ring-brand-green/30'
                        : 'border-brand-border/80 bg-brand-surface hover:border-brand-green/35 hover:shadow-card hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${theme.badgeStyle} shadow-xs`}
                        >
                          <MealIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <strong className="truncate block font-display text-base font-bold text-brand-text group-hover:text-brand-green transition-colors">
                            {row.outsideMealLogItem.name}
                          </strong>
                          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-brand-muted">
                            <span className="font-semibold text-brand-text/80">{theme.label}</span>
                            <span>·</span>
                            <span>
                              {new Date(row.outsideMealLogItem.mealLog.loggedAt).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="rounded-full border border-brand-border/80 bg-brand-bgAlt/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                          {row.queueReason?.replaceAll('_', ' ').toLowerCase() ?? 'Review'}
                        </span>
                        <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2 py-0.5 font-mono text-[10px] font-bold text-brand-green">
                          priority {row.priority}
                        </span>
                      </div>
                    </div>

                    {/* Member UI Macro Pills */}
                    <div className="mt-3.5 flex flex-wrap items-center gap-1.5 sm:gap-2 border-t border-brand-border/40 pt-3">
                      <span className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/[0.04] px-2.5 py-1 text-[11px] font-bold text-brand-text dark:border-white/10 dark:bg-white/[0.06]">
                        🔥 {Math.round(row.outsideMealLogItem.calories ?? 0)} kcal
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#08705b]/20 bg-[#08705b]/10 px-2.5 py-1 text-[11px] font-bold text-[#08705b] dark:border-[#10b981]/30 dark:bg-[#10b981]/15 dark:text-[#34d399]">
                        {row.outsideMealLogItem.proteinG ?? 0}g P
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#18b9d2]/20 bg-[#18b9d2]/10 px-2.5 py-1 text-[11px] font-bold text-[#0b7788] dark:border-[#38bdf8]/30 dark:bg-[#38bdf8]/15 dark:text-[#38bdf8]">
                        {row.outsideMealLogItem.carbsG ?? 0}g C
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#eb6a38]/20 bg-[#eb6a38]/10 px-2.5 py-1 text-[11px] font-bold text-[#c74614] dark:border-[#eb6a38]/30 dark:bg-[#eb6a38]/15 dark:text-[#f09e6c]">
                        {row.outsideMealLogItem.fatG ?? 0}g F
                      </span>
                    </div>

                    {row.claimStatus.claimedByOther && (
                      <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                        <Eye className="h-3.5 w-3.5 shrink-0" />
                        <span>Claimed by {row.claimStatus.claimedByName ?? 'another nutritionist'}</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Column: Workflow Guide or Active Inspection Form */}
        <div>
          {!selected ? (
            <div className="rounded-3xl border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-8 shadow-card space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-green/15 text-brand-green">
                <ClipboardCheck className="h-6 w-6 stroke-[2.2]" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-black tracking-tight text-brand-text">
                  A clear path to outside food review
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-brand-muted">
                  Select an outside food estimate to inspect reported nutrition values, verify against reference ranges, and calibrate portions.
                </p>
              </div>
              <div className="grid gap-3 pt-2">
                {[
                  {
                    step: '01',
                    title: 'Inspect logged intake',
                    desc: 'Review the member’s reported calories, macro distribution, and preparation context.',
                  },
                  {
                    step: '02',
                    title: 'Claim review lock',
                    desc: 'Claiming reserves the log for your review, preventing duplicate edits by other clinicians.',
                  },
                  {
                    step: '03',
                    title: 'Calibrate or clarify',
                    desc: 'Confirm accurate values, save calibrated macro corrections, or request more information.',
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="flex items-start gap-3.5 rounded-2xl border border-brand-border/60 bg-brand-bgAlt/50 p-4 transition-colors hover:border-brand-green/30"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-green/15 font-mono text-xs font-black text-brand-green">
                      {item.step}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-bold text-brand-text">{item.title}</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-brand-muted">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-brand-border/80 bg-brand-surface/90 p-6 sm:p-7 shadow-card space-y-5">
              {/* Header */}
              <div className="space-y-3 border-b border-brand-border/60 pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-brand-green/30 bg-brand-green/10 px-2.5 py-0.5 text-[10px] font-bold text-brand-green">
                      Active review
                    </span>
                    <span className="text-xs text-brand-muted">
                      Revision {selected.claimedRevision ?? selected.outsideMealLogItem.currentRevision}
                    </span>
                  </div>
                  <span className="rounded-full border border-brand-border/80 bg-brand-bgAlt/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                    {selected.queueReason?.replaceAll('_', ' ').toLowerCase() ?? 'Review'}
                  </span>
                </div>
                <div>
                  <h2 className="font-display text-2xl font-black text-brand-text">
                    {selected.outsideMealLogItem.name}
                  </h2>
                  <p className="mt-1 text-xs text-brand-muted">
                    Logged for {selected.outsideMealLogItem.mealLog.mealType ?? 'meal'} ·{' '}
                    {new Date(selected.outsideMealLogItem.mealLog.loggedAt).toLocaleString()}
                  </p>
                </div>
                {(selected.outsideMealLogItem.calorieLow !== null || selected.outsideMealLogItem.calorieHigh !== null) && (
                  <div className="inline-flex items-center gap-1.5 rounded-xl border border-brand-border/70 bg-brand-bgAlt/60 px-3 py-1.5 text-xs text-brand-muted">
                    <span className="font-medium">Estimated range:</span>
                    <span className="font-bold text-brand-text">
                      {selected.outsideMealLogItem.calorieLow ?? '—'}–{selected.outsideMealLogItem.calorieHigh ?? '—'} kcal
                    </span>
                  </div>
                )}
                {selected.outsideMealLogItem.mealLog.estimationContext && (
                  <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/70 p-3 text-xs leading-relaxed text-brand-muted">
                    <span className="font-bold text-brand-text">Preparation context: </span>
                    {selected.outsideMealLogItem.mealLog.estimationContext}
                  </div>
                )}
                {selected.outsideMealLogItem.ingredients?.length ? (
                  <div className="text-xs text-brand-muted">
                    <span className="font-semibold text-brand-text">Recorded ingredients: </span>
                    {selected.outsideMealLogItem.ingredients.join(', ')}
                  </div>
                ) : null}
                {selected.outsideMealLogItem.mealLog.outsideImageMime && (
                  <div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand-green/30 bg-brand-green/10 px-3 py-1.5 text-xs font-bold text-brand-green transition hover:bg-brand-green/20"
                      onClick={async () => {
                        try {
                          const response = await api.get(`/nutritionist/outside-meal-reviews/${selected.id}/image`, {
                            responseType: 'blob',
                          });
                          const url = URL.createObjectURL(response.data);
                          window.open(url, '_blank', 'noopener,noreferrer');
                          setTimeout(() => URL.revokeObjectURL(url), 60_000);
                        } catch (err) {
                          setError(getApiErrorMessage(err, 'Could not open this review image.'));
                        }
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View attached photo
                    </button>
                  </div>
                )}
              </div>

              {/* Clarification History */}
              {selected.messages?.length > 0 && (
                <div className="space-y-2 rounded-2xl border border-brand-border/70 bg-brand-bgAlt/40 p-3.5 text-xs">
                  <p className="font-display font-bold text-brand-text">Clarification history</p>
                  <div className="space-y-2">
                    {selected.messages.map((message) => (
                      <div
                        key={message.id}
                        className={`rounded-xl p-2.5 text-xs ${
                          message.sender === 'NUTRITIONIST'
                            ? 'border border-brand-green/25 bg-brand-green/10 text-brand-text'
                            : 'border border-brand-border bg-brand-surface text-brand-text'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-brand-muted mb-1">
                          <span className="font-bold">{message.sender === 'NUTRITIONIST' ? 'Nutritionist' : 'Member'}</span>
                          <span>revision {message.itemRevision}</span>
                        </div>
                        <p>{message.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Macro Calibration Form */}
              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold text-brand-text">Calibrate macronutrients</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-bold text-brand-text">
                    <span className="flex items-center gap-1 text-brand-muted mb-1">
                      🔥 Calories (kcal)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={correction.calories}
                      onChange={(e) => setCorrection((v) => ({ ...v, calories: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-sm font-bold text-brand-text focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                    />
                  </label>
                  <label className="text-xs font-bold text-brand-text">
                    <span className="flex items-center gap-1 text-[#08705b] dark:text-[#34d399] mb-1">
                      Protein (g)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={correction.proteinG}
                      onChange={(e) => setCorrection((v) => ({ ...v, proteinG: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-sm font-bold text-brand-text focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                    />
                  </label>
                  <label className="text-xs font-bold text-brand-text">
                    <span className="flex items-center gap-1 text-[#0b7788] dark:text-[#38bdf8] mb-1">
                      Carbohydrates (g)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={correction.carbsG}
                      onChange={(e) => setCorrection((v) => ({ ...v, carbsG: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-sm font-bold text-brand-text focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                    />
                  </label>
                  <label className="text-xs font-bold text-brand-text">
                    <span className="flex items-center gap-1 text-[#c74614] dark:text-[#f09e6c] mb-1">
                      Fat (g)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={correction.fatG}
                      onChange={(e) => setCorrection((v) => ({ ...v, fatG: e.target.value }))}
                      className="w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-sm font-bold text-brand-text focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green"
                    />
                  </label>
                </div>
              </div>

              {/* Review Reason */}
              <label className="block text-xs font-bold text-brand-text">
                <span className="block mb-1">Review reason & clinical rationale (required)</span>
                <textarea
                  value={correction.reason}
                  onChange={(e) => setCorrection((v) => ({ ...v, reason: e.target.value }))}
                  className="w-full rounded-xl border border-brand-border bg-brand-surface p-3 text-xs leading-relaxed text-brand-text placeholder:text-brand-muted focus:border-brand-green focus:outline-none focus:ring-1 focus:ring-brand-green min-h-24"
                  placeholder="e.g. Verified with standard food composition database for 1 serving"
                />
              </label>

              {/* Actions */}
              <div className="flex flex-wrap gap-2.5 pt-1">
                <Button
                  variant="primary"
                  disabled={correction.reason.trim().length < 3 || busy}
                  isLoading={busy}
                  onClick={() => void resolve('VERIFY')}
                  className="flex-1 sm:flex-initial"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm estimate
                </Button>
                <Button
                  variant="secondary"
                  disabled={correction.reason.trim().length < 3 || busy}
                  onClick={() => void resolve('CORRECT')}
                  className="flex-1 sm:flex-initial"
                >
                  Save correction
                </Button>
                <Button
                  variant="secondary"
                  disabled={correction.reason.trim().length < 3 || busy}
                  onClick={() => void resolve('NEEDS_MORE_INFO')}
                >
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Need info
                </Button>
                <Button
                  variant="secondary"
                  disabled={correction.reason.trim().length < 3 || busy}
                  onClick={() => void resolve('UNVERIFIABLE')}
                >
                  Mark unverifiable
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Consented Food Observations Section */}
      <section className="space-y-4 pt-6 border-t border-brand-border/60" aria-label="Observed food admissions">
        <div>
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-green">
            Clinical knowledge base
          </span>
          <h2 className="font-display text-xl font-black text-brand-text">Consented food observations</h2>
          <p className="mt-1 text-xs text-brand-muted max-w-2xl">
            Only current, confirmed estimates with explicit member permission appear here. Admission creates a reference
            or an unverified recipe candidate; it never certifies a meal.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <Card className="space-y-3 p-5 rounded-2xl border border-brand-border/70 shadow-xs">
            <h3 className="font-display text-sm font-bold text-brand-text mb-2">Observations awaiting classification</h3>
            {isLoading ? (
              <div className="space-y-2.5">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-brand-border/60 p-3 space-y-1.5">
                    <Skeleton className="h-4 w-36 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                  </div>
                ))}
              </div>
            ) : submissions.length === 0 ? (
              <p className="text-xs text-brand-muted italic py-4">No observations awaiting classification.</p>
            ) : (
              submissions.map((row) => (
                <button
                  type="button"
                  key={row.id}
                  onClick={() => selectObserved(row)}
                  className={`block w-full rounded-xl border p-3.5 text-left text-xs transition-all ${
                    observed?.id === row.id
                      ? 'border-brand-green bg-brand-green/10 shadow-xs'
                      : 'border-brand-border/80 bg-brand-surface hover:border-brand-green/40 hover:bg-brand-bgAlt/50'
                  }`}
                >
                  <strong className="block text-brand-text">{row.sourceOutsideMealItem?.name ?? 'Source no longer available'}</strong>
                  <span className="mt-1 block text-brand-muted">
                    {row.sourceOutsideMealItem?.portionGrams ?? 'Unknown'} g · revision {row.sourceRevision}
                  </span>
                </button>
              ))
            )}
          </Card>

          <Card className="space-y-4 p-5 rounded-2xl border border-brand-border/70 shadow-xs">
            <h3 className="font-display text-sm font-bold text-brand-text">Classification details</h3>
            {!observed ? (
              <p className="text-xs text-brand-muted italic py-4">Select a consented observation above to classify.</p>
            ) : (
              <>
                <div className="rounded-xl border border-brand-border/70 bg-brand-bgAlt/60 p-3 text-xs text-brand-muted">
                  <span className="font-bold text-brand-text">{observed.sourceOutsideMealItem?.calories} kcal</span> · P{' '}
                  {observed.sourceOutsideMealItem?.proteinG}g · C {observed.sourceOutsideMealItem?.carbsG}g · F{' '}
                  {observed.sourceOutsideMealItem?.fatG}g.
                  <p className="mt-1 text-[11px]">Source identity and private notes are excluded.</p>
                </div>
                <label className="block text-xs font-bold text-brand-text">
                  Outcome
                  <select
                    value={observedKind}
                    onChange={(event) => setObservedKind(event.target.value as typeof observedKind)}
                    className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-xs text-brand-text focus:border-brand-green focus:outline-none"
                  >
                    <option value="FOOD_REFERENCE">Observed food reference</option>
                    <option value="RECIPE_CANDIDATE">Reproducible recipe candidate</option>
                  </select>
                </label>
                <label className="block text-xs font-bold text-brand-text">
                  Deidentified canonical name
                  <input
                    value={canonicalName}
                    onChange={(event) => setCanonicalName(event.target.value)}
                    className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-xs text-brand-text focus:border-brand-green focus:outline-none"
                  />
                </label>
                {observedKind === 'RECIPE_CANDIDATE' && (
                  <>
                    <label className="block text-xs font-bold text-brand-text">
                      Ingredients, one per line: name | quantity | unit
                      <textarea
                        value={ingredientLines}
                        onChange={(event) => setIngredientLines(event.target.value)}
                        className="mt-1 min-h-24 w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-xs text-brand-text focus:border-brand-green focus:outline-none"
                      />
                    </label>
                    <label className="block text-xs font-bold text-brand-text">
                      Preparation method
                      <textarea
                        value={preparation}
                        onChange={(event) => setPreparation(event.target.value)}
                        className="mt-1 min-h-24 w-full rounded-xl border border-brand-border bg-brand-surface p-2.5 text-xs text-brand-text focus:border-brand-green focus:outline-none"
                      />
                    </label>
                    <div className="flex gap-4">
                      {['BREAKFAST', 'LUNCH', 'DINNER'].map((type) => (
                        <label key={type} className="flex items-center gap-1.5 text-xs font-medium text-brand-text">
                          <input
                            type="checkbox"
                            checked={applicableTypes.includes(type)}
                            onChange={(event) =>
                              setApplicableTypes((previous) =>
                                event.target.checked ? [...previous, type] : previous.filter((value) => value !== type)
                              )
                            }
                            className="rounded border-brand-border text-brand-green focus:ring-brand-green"
                          />
                          {type.toLowerCase()}
                        </label>
                      ))}
                    </div>
                  </>
                )}
                <Button
                  disabled={canonicalName.trim().length < 2 || busy}
                  isLoading={busy}
                  onClick={() => void admitObserved()}
                  className="w-full sm:w-auto"
                >
                  Admit deidentified {observedKind === 'FOOD_REFERENCE' ? 'reference' : 'candidate'}
                </Button>
              </>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

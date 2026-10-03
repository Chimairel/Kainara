'use client';

import PreviewConfirmation from './OutsideMealPreview';
import type { OutsideMealModalProps as Props } from './outside-meal-modal.types';

import Button from '@/components/ui/Button';
import Link from 'next/link';
import { useMembership } from '@/features/membership/MembershipProvider';
import Modal from '@/components/ui/Modal';
import RiceAccompanimentSelect from '@/components/user/RiceAccompanimentSelect';
import api from '@/lib/axios';
import { ricePlateNutrition, type RiceReference } from '@/lib/rice-accompaniment';
import type { MealType } from '@/types';
import { Camera, CheckCircle2, ChefHat, Flame, Info, Loader2, Search, Sparkles, X } from 'lucide-react';
import { toast } from 'sonner';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OutsideMealInputItem } from './model';
import { displayMacros, emptyMacros, parseItems } from './outside-meal-input';

interface Suggestion {
  kind: string;
  id: string;
  name: string;
  label: string;
  serving?: string;
  macros?: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  ricePairing?: 'ULAM' | 'RICE_INCLUDED' | 'STANDALONE';
  riceReference?: RiceReference;
}

const mealLabels: Record<MealType, string> = {
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  SNACK: 'Snack',
};

export function OutsideMealModal(props: Props) {
  return (
    <Modal
      isOpen={props.isOpen}
      onClose={() => {
        if (!props.isLoading) props.onClose();
      }}
      title="LOG FOOD OR A MEAL"
      size="lg"
      description="Track meals, snacks, drinks, or individual foods outside your plan."
    >
      <div className="flex flex-col gap-5 text-left">
        {props.warning && <PreviewConfirmation {...props} warning={props.warning} />}
        <div hidden={Boolean(props.warning)}>
          <OutsideMealForm {...props} />
        </div>
      </div>
    </Modal>
  );
}

function OutsideMealForm(props: Props) {
  const { data: membership } = useMembership();
  const estimates = membership?.enabled ? membership.usage.AI_ESTIMATE : null;
  // Autocomplete state
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchVersion = useRef(0);
  const searchController = useRef<AbortController | null>(null);
  const cancelSearch = useCallback(() => {
    searchVersion.current += 1;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    searchController.current?.abort();
    setIsSearching(false);
  }, []);
  useEffect(
    () => () => {
      searchVersion.current += 1;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      searchController.current?.abort();
    },
    []
  );

  // Nutritional values (editable numbers)
  const [manual, setManual] = useState(emptyMacros);
  const [baseNutrition, setBaseNutrition] = useState<{
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  } | null>(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState<Suggestion | null>(null);
  const [portionGrams, setPortionGrams] = useState('');
  const [riceReference, setRiceReference] = useState<RiceReference | null>(null);
  const [selectedRicePairing, setSelectedRicePairing] = useState<'ULAM' | 'RICE_INCLUDED' | 'STANDALONE' | null>(null);
  const [riceGrams, setRiceGrams] = useState(0);

  // Photo & Camera state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [consumedLocal] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  });

  const parsedItems = useMemo(() => parseItems(props.mealName), [props.mealName]);
  const ricePlatePreview =
    riceReference && riceGrams > 0
      ? ricePlateNutrition(
          {
            calories: manual.calories.trim() ? Number(manual.calories) : null,
            proteinG: manual.proteinG.trim() ? Number(manual.proteinG) : null,
            carbsG: manual.carbsG.trim() ? Number(manual.carbsG) : null,
            fatG: manual.fatG.trim() ? Number(manual.fatG) : null,
          },
          riceGrams,
          riceReference
        )
      : null;

  // Handle outside click to dismiss autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search against /api/user/meals/outside-suggestions
  const handleInputChange = useCallback(
    (value: string) => {
      cancelSearch();
      const version = searchVersion.current;
      setSuggestions([]);
      setShowDropdown(false);
      props.onMealNameChange(value);
      if (selectedSuggestion && value.trim() !== selectedSuggestion.name.trim()) {
        setSelectedSuggestion(null);
        setBaseNutrition(null);
        setManual(emptyMacros);
        setPortionGrams('');
        setRiceReference(null);
        setSelectedRicePairing(null);
        setRiceGrams(0);
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const query = value.trim();
      if (query.length < 2 || query.length > 100) {
        setSuggestions([]);
        setShowDropdown(false);
        setIsSearching(false);
        return;
      }

      setIsSearching(true);
      debounceTimerRef.current = setTimeout(async () => {
        const controller = new AbortController();
        searchController.current = controller;
        try {
          const res = await api.get('/user/meals/outside-suggestions', {
            params: { search: query },
            signal: controller.signal,
          });
          if (version !== searchVersion.current) return;
          if (res.data?.success && res.data.data) {
            const eligible: Suggestion[] = res.data.data.eligible || [];
            const otherKnown: Suggestion[] = res.data.data.otherKnown || [];
            const combined = [...eligible, ...otherKnown];
            setSuggestions(combined);
            setShowDropdown(combined.length > 0);
          } else {
            setSuggestions([]);
            setShowDropdown(false);
          }
        } catch {
          if (version !== searchVersion.current) return;
          setSuggestions([]);
          setShowDropdown(false);
        } finally {
          if (version === searchVersion.current) setIsSearching(false);
        }
      }, 250);
    },
    [props, selectedSuggestion, cancelSearch]
  );

  // Auto-fill values when a dish suggestion is selected
  const handleSelectSuggestion = (dish: Suggestion) => {
    cancelSearch();
    props.onMealNameChange(dish.name);
    setSelectedSuggestion(dish);
    setPortionGrams(dish.kind === 'FNRI_FOOD' ? '100' : '');
    setSelectedRicePairing(dish.ricePairing ?? null);
    setRiceReference(
      dish.ricePairing === 'ULAM' || dish.ricePairing === 'RICE_INCLUDED' ? (dish.riceReference ?? null) : null
    );
    setRiceGrams(0);

    if (dish.macros) {
      setBaseNutrition(dish.macros);
      setManual(displayMacros(dish.macros));
    } else {
      setBaseNutrition(null);
      setManual(emptyMacros);
    }
    setShowDropdown(false);
  };

  // Quick portion multiplier presets (keeps all values freely editable!)
  const applyPortionMultiplier = (multiplier: number) => {
    if (!baseNutrition) return;
    setManual(
      displayMacros({
        calories: baseNutrition.calories * multiplier,
        proteinG: baseNutrition.proteinG * multiplier,
        carbsG: baseNutrition.carbsG * multiplier,
        fatG: baseNutrition.fatG * multiplier,
      })
    );
    if (selectedSuggestion?.kind === 'FNRI_FOOD') setPortionGrams(String(100 * multiplier));
  };

  // Handle Photo selection from camera or file picker
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) {
        setImageFile(null);
        setImagePreview(null);
        setImageError('Choose a JPG, PNG, or WebP image under 2 MB.');
        return;
      }
      setImageFile(file);
      setImageError(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setImageFile(null);
    setImagePreview(null);
    setImageError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Submit with user-entered or auto-filled editable manual values
  const handleSubmit = (useAi = false) => {
    if (props.isLoading) return;
    if (imageError) {
      toast.error(imageError);
      return;
    }
    if (!props.mealName.trim()) {
      toast.error('Enter the food you ate.');
      return;
    }
    if (parsedItems.length > 10 || parsedItems.some((item) => !item.name || item.name.length > 180)) {
      toast.error('Enter up to 10 foods, with names no longer than 180 characters.');
      return;
    }
    if (
      portionGrams.trim() &&
      (!Number.isFinite(Number(portionGrams)) || Number(portionGrams) <= 0 || Number(portionGrams) > 5000)
    ) {
      toast.error('Enter a portion greater than 0 and no more than 5,000 grams.');
      return;
    }
    const selectedName = selectedSuggestion?.name ?? props.mealName.trim();
    const hasManual =
      manual.calories.trim() !== '' ||
      manual.proteinG.trim() !== '' ||
      manual.carbsG.trim() !== '' ||
      manual.fatG.trim() !== '';

    if (
      hasManual &&
      !useAi &&
      Object.values(manual).some((value) => !value.trim() || !Number.isFinite(Number(value)) || Number(value) < 0)
    ) {
      toast.error('Enter calories, protein, carbs, and fat. Use 0 only when the value is zero.');
      return;
    }
    let submittedItems: OutsideMealInputItem[];

    const enteredGrams = Number(portionGrams);
    const measuredGrams = Number.isFinite(enteredGrams) && enteredGrams > 0 ? enteredGrams : null;
    const fnriGrams = selectedSuggestion?.kind === 'FNRI_FOOD' ? measuredGrams : null;
    if (selectedSuggestion?.kind === 'FNRI_FOOD' && !fnriGrams) {
      toast.error('Enter the amount eaten in grams.');
      return;
    }
    const referenceFactor = selectedSuggestion?.kind === 'FNRI_FOOD' && fnriGrams ? fnriGrams / 100 : 1;
    const referenceMacros = baseNutrition
      ? displayMacros({
          calories: baseNutrition.calories * referenceFactor,
          proteinG: baseNutrition.proteinG * referenceFactor,
          carbsG: baseNutrition.carbsG * referenceFactor,
          fatG: baseNutrition.fatG * referenceFactor,
        })
      : null;
    const unchangedReference =
      referenceMacros &&
      (Object.keys(referenceMacros) as Array<keyof typeof referenceMacros>).every(
        (key) => manual[key] === referenceMacros[key]
      );
    const useReference =
      !useAi &&
      unchangedReference &&
      (selectedSuggestion?.kind === 'ELIGIBLE_LIBRARY' || selectedSuggestion?.kind === 'FNRI_FOOD');

    if (hasManual && !useAi && !useReference) {
      const singleItem: OutsideMealInputItem = {
        name: selectedName || 'Custom food',
        ...(measuredGrams ? { portionGrams: measuredGrams } : {}),
        reportedNutrition: {
          calories: Number(manual.calories) || 0,
          proteinG: Number(manual.proteinG) || 0,
          carbsG: Number(manual.carbsG) || 0,
          fatG: Number(manual.fatG) || 0,
        },
      };
      if (
        selectedSuggestion?.id &&
        (selectedSuggestion.kind === 'ELIGIBLE_LIBRARY' || selectedSuggestion.kind === 'KNOWN_CATALOG')
      ) {
        singleItem.mealLibraryId = selectedSuggestion.id;
      }
      submittedItems = [singleItem];
    } else {
      submittedItems = selectedSuggestion
        ? [{ name: selectedName }]
        : parsedItems.length > 0
          ? parsedItems.map((item) => ({ ...item }))
          : [{ name: selectedName }];
      if (fnriGrams && submittedItems.length === 1) submittedItems[0].portionGrams = fnriGrams;
      else if (measuredGrams && submittedItems.length === 1) submittedItems[0].portionGrams = measuredGrams;
      if (
        selectedSuggestion?.id &&
        (selectedSuggestion.kind === 'ELIGIBLE_LIBRARY' || selectedSuggestion.kind === 'KNOWN_CATALOG') &&
        submittedItems.length === 1
      ) {
        submittedItems[0].mealLibraryId = selectedSuggestion.id;
      }
    }

    if (riceReference && riceGrams > 0) {
      submittedItems.push({ name: riceReference.name, portionGrams: riceGrams });
    }

    props.onSubmit(false, {
      useAiEstimate: useAi,
      items: submittedItems,
      consumedAt: new Date(consumedLocal).toISOString(),
      estimationContext: props.notes,
      imageFile,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(false);
      }}
      className="text-left"
    >
      <fieldset disabled={props.isLoading} className="flex min-w-0 flex-col gap-3">
        {/* 1. Meal Category Segmented Control */}
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            When did you eat it? (required)
          </legend>
          <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl border border-brand-border/70 bg-brand-bgAlt/50 text-center text-xs font-semibold">
            {(Object.keys(mealLabels) as MealType[]).map((type) => {
              const isSelected = props.mealType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => props.onMealTypeChange(type)}
                  className={`rounded-xl py-2 px-1 text-xs font-bold outline-none transition-all duration-150 ${
                    isSelected
                      ? 'bg-brand-green text-white shadow-xs dark:bg-brand-accent dark:text-[#07100d]'
                      : 'text-brand-muted hover:text-brand-text hover:bg-brand-surface/70'
                  }`}
                >
                  {mealLabels[type]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* 2. Food or Meal Eaten with Autocomplete */}
        <div ref={searchContainerRef} className="relative flex flex-col gap-1">
          <label htmlFor="mealNameInput" className="text-xs font-bold uppercase tracking-wider text-brand-muted">
            Food or Meal Eaten (required)
          </label>
          <div className="relative flex items-center">
            <div className="pointer-events-none absolute left-3.5 text-brand-muted">
              <Search className="h-4 w-4" />
            </div>
            <input
              id="mealNameInput"
              type="text"
              placeholder="e.g. small apple, chicken adobo (150g), brown rice"
              value={props.mealName}
              onChange={(e) => handleInputChange(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowDropdown(true);
              }}
              disabled={props.isLoading}
              required
              className="w-full rounded-2xl border border-brand-border/80 bg-brand-surface/90 pl-10 pr-9 py-2 text-xs font-semibold text-brand-text placeholder-brand-muted/60 outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
            {isSearching ? (
              <Loader2 className="absolute right-3.5 h-4 w-4 animate-spin text-brand-green" />
            ) : props.mealName ? (
              <button
                type="button"
                onClick={() => {
                  cancelSearch();
                  props.onMealNameChange('');
                  setSuggestions([]);
                  setShowDropdown(false);
                  setSelectedSuggestion(null);
                  setBaseNutrition(null);
                  setRiceReference(null);
                  setSelectedRicePairing(null);
                  setRiceGrams(0);
                  setManual(emptyMacros);
                  setPortionGrams('');
                }}
                className="absolute right-3.5 text-brand-muted hover:text-brand-text"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <p className="mt-0.5 text-[10px] text-brand-muted">
            For multiple foods, separate each one with a comma. Add a measured portion like{' '}
            <strong className="text-brand-text">rice (150g)</strong> for FNRI matching.
          </p>

          {/* Autocomplete Dropdown List */}
          {showDropdown && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-brand-border/80 bg-brand-surface shadow-card-lg backdrop-blur-md">
              <div className="p-1.5 border-b border-brand-border/40 text-[10px] font-bold uppercase tracking-wider text-brand-muted px-3 pt-2 pb-1">
                Matching Recipes & Foods ({suggestions.length})
              </div>
              {suggestions.map((dish) => (
                <button
                  key={`${dish.kind}-${dish.id}`}
                  type="button"
                  onClick={() => handleSelectSuggestion(dish)}
                  className="flex w-full items-center justify-between gap-2 border-b border-brand-border/30 px-3.5 py-2 text-left text-xs transition hover:bg-brand-green/10 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {dish.kind === 'ELIGIBLE_LIBRARY' || dish.kind === 'KNOWN_CATALOG' ? (
                        <ChefHat className="h-3.5 w-3.5 shrink-0 text-brand-green" />
                      ) : (
                        <Search className="h-3.5 w-3.5 shrink-0 text-brand-muted" />
                      )}
                      <span className="truncate font-semibold text-brand-text">{dish.name}</span>
                    </div>
                    <span className="text-[10px] text-brand-muted">
                      {dish.serving ? `${dish.label} · ${dish.serving}` : dish.label}
                    </span>
                  </div>
                  {dish.macros && (
                    <div className="shrink-0 text-right">
                      <span className="font-extrabold text-brand-green">{Math.round(dish.macros.calories)} kcal</span>
                      <span className="block text-[10px] text-brand-muted">
                        {Math.round(dish.macros.proteinG * 10) / 10}g P · {Math.round(dish.macros.carbsG * 10) / 10}g C
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedSuggestion?.kind === 'FNRI_FOOD' && baseNutrition && (
          <div className="flex flex-col gap-1 rounded-2xl border border-brand-border/70 bg-brand-surface/50 p-3">
            <label htmlFor="fnriPortionGrams" className="text-xs font-bold text-brand-text/90">
              Amount eaten (grams)
            </label>
            <div className="relative">
              <input
                id="fnriPortionGrams"
                type="number"
                min="1"
                step="1"
                required
                value={portionGrams}
                onChange={(event) => {
                  const grams = event.target.value;
                  setPortionGrams(grams);
                  const factor = Number(grams) / 100;
                  setManual(
                    grams && factor > 0
                      ? displayMacros({
                          calories: baseNutrition.calories * factor,
                          proteinG: baseNutrition.proteinG * factor,
                          carbsG: baseNutrition.carbsG * factor,
                          fatG: baseNutrition.fatG * factor,
                        })
                      : emptyMacros
                  );
                }}
                className="w-full rounded-xl border border-brand-border/80 bg-brand-bgAlt/80 px-3.5 py-2 text-xs font-bold text-brand-text outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
              />
              <span className="absolute right-3.5 top-2 text-xs font-bold text-brand-muted pointer-events-none">g</span>
            </div>
            <p className="text-[10px] text-brand-muted">FNRI values are per 100 g; this amount scales the estimate.</p>
          </div>
        )}

        {selectedSuggestion?.kind !== 'FNRI_FOOD' && selectedSuggestion?.kind !== 'ELIGIBLE_LIBRARY' && (
          <div className="flex flex-col gap-1">
            <label htmlFor="outsidePortionGrams" className="text-xs font-bold text-brand-text/90">
              Approximate portion in grams (optional)
            </label>
            <div className="relative">
              <input
                id="outsidePortionGrams"
                type="number"
                min="1"
                max="5000"
                step="1"
                value={portionGrams}
                onChange={(event) => setPortionGrams(event.target.value)}
                disabled={props.isLoading}
                className="w-full rounded-2xl border border-brand-border/80 bg-brand-surface/80 px-3.5 py-2 text-xs text-brand-text outline-none focus:border-brand-green focus:ring-1 focus:ring-brand-green"
              />
              <span className="absolute right-3.5 top-2 text-xs font-bold text-brand-muted pointer-events-none">g</span>
            </div>
            <p className="text-[10px] text-brand-muted">
              Add grams if you know them. AI can estimate a typical serving from the food name; notes make it more
              specific.
            </p>
          </div>
        )}

        {/* 3. Nutritional Values (Estimated) - Open by default & fully editable */}
        <div className="rounded-2xl border border-brand-border/70 bg-brand-surface/60 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Flame className="h-4 w-4 text-brand-green" />
              <span className="text-xs font-bold text-brand-text">Nutritional Values (Estimated)</span>
            </div>
            {selectedSuggestion && (
              <span className="flex items-center gap-1 text-[11px] font-semibold text-brand-green">
                <CheckCircle2 className="h-3 w-3" />
                {selectedSuggestion.kind === 'ELIGIBLE_LIBRARY'
                  ? 'From verified recipe'
                  : selectedSuggestion.kind === 'KNOWN_CATALOG'
                    ? 'From catalog; safety not confirmed'
                    : selectedSuggestion.kind === 'FNRI_FOOD'
                      ? 'From FNRI · per 100g reference'
                      : 'From observed reference'}
              </span>
            )}
          </div>

          {/* 4 Numeric Inputs side-by-side with theme macro badges */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-2 transition focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green">
              <label className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                <span className="h-2 w-2 rounded-full bg-brand-green" />
                Calories (kcal)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="0"
                  value={manual.calories}
                  onChange={(e) => setManual((prev) => ({ ...prev, calories: e.target.value }))}
                  className="w-full bg-transparent px-1 py-0.5 text-xs font-bold text-brand-text outline-none"
                />
                <span className="absolute right-1 top-0.5 text-[10px] font-semibold text-brand-muted pointer-events-none">
                  kcal
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-2 transition focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green">
              <label className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--macro-protein)' }} />
                Protein (g)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={manual.proteinG}
                  onChange={(e) => setManual((prev) => ({ ...prev, proteinG: e.target.value }))}
                  className="w-full bg-transparent px-1 py-0.5 text-xs font-bold text-macro-protein outline-none"
                />
                <span className="absolute right-1 top-0.5 text-[10px] font-semibold text-brand-muted pointer-events-none">
                  g
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-2 transition focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green">
              <label className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--macro-carbs)' }} />
                Carbs (g)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={manual.carbsG}
                  onChange={(e) => setManual((prev) => ({ ...prev, carbsG: e.target.value }))}
                  className="w-full bg-transparent px-1 py-0.5 text-xs font-bold text-macro-carbs outline-none"
                />
                <span className="absolute right-1 top-0.5 text-[10px] font-semibold text-brand-muted pointer-events-none">
                  g
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-brand-border/60 bg-brand-bgAlt/50 p-2 transition focus-within:border-brand-green focus-within:ring-1 focus-within:ring-brand-green">
              <label className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-muted">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: 'var(--macro-fat)' }} />
                Fat (g)
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={manual.fatG}
                  onChange={(e) => setManual((prev) => ({ ...prev, fatG: e.target.value }))}
                  className="w-full bg-transparent px-1 py-0.5 text-xs font-bold text-macro-fat outline-none"
                />
                <span className="absolute right-1 top-0.5 text-[10px] font-semibold text-brand-muted pointer-events-none">
                  g
                </span>
              </div>
            </div>
          </div>

          {/* Portion multiplier pills for easy scaling while keeping inputs editable */}
          {baseNutrition && (
            <div className="mt-2.5 flex items-center justify-between border-t border-brand-border/40 pt-2 text-[11px]">
              <span className="text-brand-muted font-medium">Quick portion scaling:</span>
              <div className="flex gap-1.5">
                {[0.5, 1, 1.5, 2].map((factor) => (
                  <button
                    key={factor}
                    type="button"
                    onClick={() => applyPortionMultiplier(factor)}
                    className="rounded-full border border-brand-border/70 bg-brand-surface px-2.5 py-0.5 font-bold text-brand-muted hover:border-brand-green hover:text-brand-green transition"
                  >
                    {factor}x
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-brand-muted">
            <Info className="h-3 w-3 shrink-0" />
            Values are editable. Tweak any numbers above or enter your own nutrition-label or menu values.
          </p>
        </div>

        {riceReference && baseNutrition && (
          <div className="space-y-2">
            {selectedRicePairing === 'RICE_INCLUDED' && (
              <p className="text-xs text-brand-muted">
                The recipe estimate already includes its listed rice. If your rice portion within the dish differs, edit
                the nutrition estimate above. Use this field only for rice added beyond the recipe serving.
              </p>
            )}
            <RiceAccompanimentSelect
              id="outside-meal-rice"
              grams={riceGrams}
              onChange={setRiceGrams}
              rice={riceReference}
              extra={selectedRicePairing === 'RICE_INCLUDED'}
            />
            {ricePlatePreview && (
              <p className="text-xs font-semibold text-brand-text">
                Plate preview: {Math.round(ricePlatePreview.calories)} kcal ·{' '}
                {Math.round(ricePlatePreview.carbsG * 10) / 10}g carbs. Rice appears as its own FNRI item in the
                confirmation.
              </p>
            )}
          </div>
        )}

        {/* 4. Side-by-Side Dual Reference Block: Photo Upload on Left, Notes on Right */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* Left: Add Image / Camera Capture */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-muted">Add photo (optional)</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="group relative flex h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-border/70 bg-brand-surface/40 p-2.5 text-center transition hover:border-brand-green/60 hover:bg-brand-surface/60 overflow-hidden"
            >
              {imagePreview ? (
                <>
                  {/* A local blob/data URL preview cannot use the Next image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={imagePreview} alt="Meal photo preview" className="h-full w-full object-cover rounded-xl" />
                  <button
                    type="button"
                    onClick={handleClearImage}
                    className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white hover:bg-black transition shadow-sm"
                    title="Remove photo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <>
                  <div className="mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-brand-bgAlt/90 text-brand-muted group-hover:text-brand-green group-hover:scale-110 transition">
                    <Camera className="h-4 w-4" />
                  </div>
                  <span className="text-[11px] font-bold text-brand-muted group-hover:text-brand-text transition">
                    Upload Photo or Use Camera (Optional)
                  </span>
                  <span className="text-[9px] text-brand-muted/70">Tap to capture or upload</span>
                </>
              )}
            </div>
            {imageError && <span className="text-[10px] text-status-error-text">{imageError}</span>}
          </div>

          {/* Right: Notes */}
          <div className="flex flex-col gap-1">
            <label htmlFor="mealNotes" className="text-xs font-bold uppercase tracking-wider text-brand-muted">
              Notes (optional)
            </label>
            <textarea
              id="mealNotes"
              rows={3}
              placeholder="e.g. restaurant, preparation, serving details"
              value={props.notes}
              onChange={(e) => props.onNotesChange(e.target.value)}
              disabled={props.isLoading}
              className="h-24 w-full resize-none rounded-2xl border border-brand-border/80 bg-brand-surface/80 p-2.5 text-xs text-brand-text placeholder-brand-muted/60 outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/20"
            />
          </div>
        </div>

        {/* 5. AI Assistant Fallback ("Still not sure?") */}
        <div className="rounded-2xl border border-brand-green/25 bg-gradient-to-br from-brand-green/10 via-brand-surface/60 to-brand-accent/5 p-3 text-center">
          <span className="mb-1.5 block text-xs font-bold text-brand-muted">Still not sure?</span>
          <button
            type="button"
            onClick={() => handleSubmit(true)}
            disabled={props.isLoading || !props.mealName.trim() || estimates?.remaining === 0}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-brand-green/50 bg-brand-green/15 py-2 px-4 text-xs font-extrabold text-brand-green transition hover:bg-brand-green/25 disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
          >
            <Sparkles className="h-4 w-4 text-brand-green" />
            HELP ME FIND VALUES WITH AI
          </button>
          <p className="mt-1.5 text-[10px] text-brand-muted">
            Grams and notes are optional. Without them, AI assumes a typical serving. Values remain provisional; review
            may be required or requested separately.
          </p>
          {estimates && (
            <p className="mt-2 text-xs text-brand-muted">
              {estimates.remaining} of {estimates.cap} AI estimate requests left this week. One request covers this
              submission. Manual logging remains available.{' '}
              <Link href="/membership" className="font-semibold text-brand-green">
                View membership
              </Link>
            </p>
          )}
        </div>

        {/* 6. Primary Action: LOG THIS MEAL */}
        <Button
          type="submit"
          variant="primary"
          className="w-full py-3.5 text-xs font-black uppercase tracking-wider rounded-2xl shadow-neon"
          disabled={
            props.isLoading ||
            !props.mealName.trim() ||
            Boolean(imageError) ||
            (selectedSuggestion?.kind === 'FNRI_FOOD' && !(Number(portionGrams) > 0))
          }
        >
          LOG THIS FOOD
        </Button>
      </fieldset>
    </form>
  );
}

export default OutsideMealModal;

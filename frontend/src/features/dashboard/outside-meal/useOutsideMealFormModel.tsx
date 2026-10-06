'use client';
import { formatMealTitle } from '@/lib/meal-title';

import type { OutsideMealModalProps as Props } from '../outside-meal-modal.types';

import { useMembership } from '@/features/membership/MembershipProvider';

import api from '@/lib/axios';
import { ricePlateNutrition, type RiceReference } from '@/lib/rice-accompaniment';

import { toast } from 'sonner';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OutsideMealInputItem } from '../model';
import { displayMacros, emptyMacros, parseItems } from '../outside-meal-input';
import { Suggestion } from './OutsideMealForm.shared';
export function useOutsideMealFormModel(props: Props) {
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
      if (selectedSuggestion && value.trim() !== formatMealTitle(selectedSuggestion.name)) {
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
    props.onMealNameChange(formatMealTitle(dish.name));
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

  return {
    kind: 'ready' as const,
    handleSubmit,
    props,
    searchContainerRef,
    handleInputChange,
    suggestions,
    setShowDropdown,
    isSearching,
    cancelSearch,
    setSuggestions,
    setSelectedSuggestion,
    setBaseNutrition,
    setRiceReference,
    setSelectedRicePairing,
    setRiceGrams,
    setManual,
    setPortionGrams,
    showDropdown,
    handleSelectSuggestion,
    selectedSuggestion,
    baseNutrition,
    portionGrams,
    applyPortionMultiplier,
    manual,
    riceReference,
    selectedRicePairing,
    riceGrams,
    ricePlatePreview,
    fileInputRef,
    handleImageChange,
    imagePreview,
    handleClearImage,
    imageError,
    estimates,
  };
}

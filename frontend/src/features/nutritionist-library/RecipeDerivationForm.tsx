'use client';

import Dropdown from '@/components/ui/Dropdown';
import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import Button from '@/components/ui/Button';
import type { LibraryMeal } from './useNutritionistLibrary';

type Food = {
  id: string;
  name: string;
  source: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};
type Ingredient = { foodItemId: string; name: string; grams: number; food?: Partial<Food> | null };
export default function RecipeDerivationForm({
  meal,
  onCreated,
}: {
  meal: LibraryMeal;
  onCreated: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(meal.mealName);
  const [summary, setSummary] = useState((meal.description ?? '').split('Preparation instructions:')[0].trim());
  const [instructions, setInstructions] = useState(
    (meal.description ?? '').split('Preparation instructions:')[1]?.trim() ?? ''
  );
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    (meal.ingredients ?? []).map((item) => ({
      foodItemId: item.foodItemId ?? '',
      name: item.ingredientName,
      grams: item.unit?.toLowerCase() === 'g' ? (item.quantity ?? 0) : 0,
      food: item.foodItem,
    }))
  );
  const [search, setSearch] = useState('');
  const [foods, setFoods] = useState<Food[]>([]);
  const [role, setRole] = useState(meal.riceRole ?? 'STANDALONE');
  const [riceGrams, setRiceGrams] = useState(meal.includedRiceG ?? 150);
  const [minRice, setMinRice] = useState(meal.riceMinHalfCups ?? 1);
  const [maxRice, setMaxRice] = useState(meal.riceMaxHalfCups ?? 3);
  const [image, setImage] = useState(meal.adaptedImageUrl ?? meal.sourceRawRecipeCandidate?.sourceImageUrl ?? '');
  const [imageMatches, setImageMatches] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!open || search.trim().length < 2) {
      setFoods([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void api
        .get('/nutritionist/recipe-foods', { params: { search }, signal: controller.signal })
        .then((response) => {
          if (!controller.signal.aborted) setFoods(response.data.data);
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('Ingredient search failed. Try again.');
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, search]);
  const completeNutrition =
    ingredients.length > 0 &&
    ingredients.every(
      (item) =>
        item.food &&
        ['calories', 'proteinG', 'carbsG', 'fatG'].every((key) => typeof item.food?.[key as keyof Food] === 'number')
    );
  const totals = ingredients.reduce(
    (total, item) => ({
      calories: total.calories + ((item.food?.calories ?? 0) * item.grams) / 100,
      proteinG: total.proteinG + ((item.food?.proteinG ?? 0) * item.grams) / 100,
      carbsG: total.carbsG + ((item.food?.carbsG ?? 0) * item.grams) / 100,
      fatG: total.fatG + ((item.food?.fatG ?? 0) * item.grams) / 100,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
  const inputClass = 'w-full rounded-xl border border-brand-border bg-brand-bg p-2 text-sm';
  const submit = async () => {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await api.post(`/nutritionist/library/${meal.id}/derive`, {
        expectedRevision: meal.safetyEvidenceRevision,
        mealName: name,
        summary,
        instructions,
        mealType: meal.mealType,
        ingredients: ingredients.map(({ foodItemId, grams }) => ({ foodItemId, grams })),
        riceRole: role,
        includedRiceG: role === 'INCLUDES_RICE' ? riceGrams : null,
        riceMinHalfCups: minRice,
        riceMaxHalfCups: maxRice,
        imageUrl: image.trim() || null,
        imageMatchesRecipe: imageMatches,
        rationale: reason,
      });
      onCreated(result.data.data.id);
    } catch (err) {
      setError(
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
          'The recipe draft could not be saved.'
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <section
      className="rounded-2xl border border-brand-border bg-brand-surface p-5 space-y-4"
      aria-label="Create recipe version"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">Adapt recipe or change serving</h2>
          <p className="text-sm text-brand-muted">
            Save a new draft. The original and its approvals stay intact; another nutritionist must review your changes.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(!open)}>
          {open ? 'Cancel editing' : 'Create recipe draft'}
        </Button>
      </div>
      {open && (
        <div className="space-y-4">
          <label className="block text-sm">
            Recipe name
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} maxLength={180} />
          </label>
          <p className="text-xs text-brand-muted">
            Adding, removing or substituting an ingredient creates a separate adapted meal. Give it a distinct name and
            matching image.
          </p>
          <label className="block text-sm">
            Summary
            <textarea
              className={inputClass}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={1000}
            />
          </label>
          <label className="block text-sm">
            Preparation instructions
            <textarea
              className={inputClass}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              maxLength={4000}
              rows={4}
            />
          </label>
          <h3 className="font-bold">Ingredients per serving</h3>
          <p aria-live="polite" className="text-sm text-brand-green">
            {completeNutrition
              ? `${Math.round(totals.calories)} kcal · ${totals.proteinG.toFixed(1)} g protein · ${totals.carbsG.toFixed(1)} g carbs · ${totals.fatG.toFixed(1)} g fat`
              : 'Select food records and measured edible grams for a nutrition preview.'}
          </p>
          {ingredients.map((item, index) => (
            <div key={`${item.foodItemId}-${index}`} className="flex flex-wrap items-center gap-2">
              <span className="flex-1 text-sm">
                {item.name}
                {!item.foodItemId && <strong className="text-status-error-text"> · Select a catalogue record</strong>}
              </span>
              <label className="text-xs">
                Edible grams
                <input
                  aria-label={`Grams for ${item.name}`}
                  type="number"
                  min="0.1"
                  step="0.1"
                  className={`${inputClass} max-w-24`}
                  value={item.grams}
                  onChange={(e) =>
                    setIngredients((items) =>
                      items.map((old, i) => (i === index ? { ...old, grams: Number(e.target.value) } : old))
                    )
                  }
                />
              </label>
              <Button
                variant="secondary"
                onClick={() => setIngredients((items) => items.filter((_, i) => i !== index))}
              >
                Remove
              </Button>
            </div>
          ))}
          <label className="block text-sm">
            Add FNRI or USDA ingredient
            <input
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search food catalogue"
            />
          </label>
          <div className="space-y-1">
            {foods.map((food) => (
              <button
                type="button"
                key={food.id}
                className={`${inputClass} text-left`}
                disabled={ingredients.some((item) => item.foodItemId === food.id)}
                onClick={() => {
                  setIngredients((items) => [...items, { foodItemId: food.id, name: food.name, grams: 100, food }]);
                  setSearch('');
                }}
              >
                {food.name} · {food.source}
              </button>
            ))}
          </div>
          <p className="text-xs text-brand-muted">
            Nutrition is recalculated from measured ingredient amounts. The reviewer reassesses allergens and
            suitability.
          </p>
          <label className="block text-sm">
            Rice pairing
            <Dropdown className={inputClass} value={role} onChange={(e) => setRole(e as typeof role)}>
              <option value="STANDALONE">Complete without rice</option>
              <option value="PAIR_WITH_RICE">Can be paired with rice</option>
              <option value="INCLUDES_RICE">Rice already in recipe</option>
            </Dropdown>
          </label>
          {role === 'PAIR_WITH_RICE' && (
            <div className="flex gap-3">
              {[
                ['Minimum rice cups (approx.)', minRice, setMinRice],
                ['Maximum rice cups (approx.)', maxRice, setMaxRice],
              ].map(([label, value, setter]) => (
                <label key={label as string} className="text-sm">
                  {label as string}
                  <Dropdown
                    className={inputClass}
                    value={value as number}
                    onChange={(e) => (setter as (v: number) => void)(Number(e))}
                  >
                    {[1, 2, 3, 4, 5, 6].map((units) => (
                      <option key={units} value={units}>
                        {units / 2} cup{units > 2 ? 's' : ''}
                      </option>
                    ))}
                  </Dropdown>
                </label>
              ))}
            </div>
          )}
          {role === 'INCLUDES_RICE' && (
            <label className="block text-sm">
              Cooked rice already included (grams)
              <input
                className={inputClass}
                type="number"
                value={riceGrams}
                onChange={(e) => setRiceGrams(Number(e.target.value))}
              />
            </label>
          )}
          <label className="block text-sm">
            Recipe image URL (HTTPS)
            <input
              className={inputClass}
              type="url"
              value={image}
              onChange={(e) => {
                setImage(e.target.value);
                setImageMatches(false);
              }}
            />
          </label>
          <label className="flex gap-2 text-sm">
            <input type="checkbox" checked={imageMatches} onChange={(e) => setImageMatches(e.target.checked)} />
            The image accurately represents this recipe, or no image is supplied for this serving version.
          </label>
          <label className="block text-sm">
            Reason for changes
            <textarea
              className={inputClass}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={1000}
            />
          </label>
          {error && (
            <p role="alert" className="text-status-error-text">
              {error}
            </p>
          )}
          <Button
            onClick={() => void submit()}
            isLoading={busy}
            disabled={
              !imageMatches ||
              reason.trim().length < 10 ||
              instructions.trim().length < 10 ||
              !ingredients.length ||
              ingredients.some((item) => !item.foodItemId || item.grams <= 0)
            }
          >
            Submit for independent review
          </Button>
        </div>
      )}
    </section>
  );
}

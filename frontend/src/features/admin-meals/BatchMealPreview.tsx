'use client';
import { useMemo, useState } from 'react';
import MealImage from '@/components/user/MealImage';
import NativeSelect from '@/components/ui/NativeSelect';
import { formatMealTitle } from '@/lib/meal-title';
import type { PublicMealImage } from '@/types';
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const string = (value: unknown) => (typeof value === 'string' ? value : '');
export default function BatchMealPreview({ text }: { text: string }) {
  const parsed = useMemo(() => {
    try {
      const input = record(JSON.parse(text));
      return { meals: Array.isArray(input.meals) ? input.meals.slice(0, 100).map(record) : [], invalid: false };
    } catch {
      return { meals: [], invalid: Boolean(text.trim()) };
    }
  }, [text]);
  const [selected, setSelected] = useState(0);
  const index = Math.min(selected, Math.max(0, parsed.meals.length - 1));
  const meal = parsed.meals[index];
  const imageData = record(meal?.image);
  const image: PublicMealImage | null =
    typeof imageData.url === 'string'
      ? {
          url: imageData.url,
          altText: string(imageData.altText),
          kind: imageData.imageKind === 'EXACT' ? 'EXACT' : 'REPRESENTATIVE',
          attribution: {
            creator: string(imageData.creator) || null,
            sourcePageUrl: null,
            licenseCode: string(imageData.licenseCode) || null,
            licenseUrl: null,
            modifications: null,
          },
        }
      : null;
  return (
    <aside
      aria-label="Draft meal preview"
      className="min-w-0 border-t border-brand-border bg-brand-bgAlt/30 xl:border-l xl:border-t-0"
    >
      <div className="border-b border-brand-border px-5 py-4">
        <h3 className="font-display text-base font-bold">Draft preview</h3>
        <p className="mt-1 text-xs leading-relaxed text-brand-muted">
          From your JSON. Validate to check fields, FNRI mappings and duplicates.
        </p>
      </div>
      {meal ? (
        <div className="space-y-5 p-5">
          <label className="block text-xs font-semibold text-brand-muted">
            Meal in this batch
            <NativeSelect
              className="mt-2 min-h-11 w-full rounded-xl border border-brand-border bg-brand-surface px-3 text-sm text-brand-text"
              value={index}
              onChange={(event) => setSelected(Number(event.target.value))}
            >
              {parsed.meals.map((entry, i) => (
                <option key={i} value={i}>
                  {i + 1}. {string(entry.mealName) || 'Untitled meal'}
                </option>
              ))}
            </NativeSelect>
          </label>
          <div className="aspect-[3/2] overflow-hidden rounded-xl">
            <MealImage
              image={image}
              mealName={string(meal.mealName)}
              variant="detail"
              className="h-full w-full"
              allowCanonicalFallback={false}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-brand-muted">
              {string(meal.mealType) || 'Meal type missing'} · Unverified draft
            </p>
            <h4 className="mt-1 break-words font-display text-xl font-bold">
              {formatMealTitle(string(meal.mealName)) || 'Untitled meal'}
            </h4>
            <p className="mt-2 break-words text-sm leading-relaxed text-brand-muted">
              {string(meal.summary) || 'Add a short recipe summary.'}
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-y border-brand-border py-4 text-xs">
            {(
              [
                ['calories', 'Energy', 'kcal'],
                ['proteinG', 'Protein', 'g'],
                ['carbsG', 'Carbs', 'g'],
                ['fatG', 'Fat', 'g'],
              ] as const
            ).map(([key, label, unit]) => (
              <div key={key}>
                <dt className="text-brand-muted">{label}</dt>
                <dd className="mt-1 font-mono font-semibold tabular-nums">
                  {typeof meal[key] === 'number' ? `${meal[key]} ${unit}` : 'Not entered'}
                </dd>
              </div>
            ))}
          </dl>
          <div className="space-y-2 text-xs leading-relaxed text-brand-muted">
            <p>{string(meal.nutritionServingDescription) || 'Serving description missing'}</p>
            <p>{Array.isArray(meal.ingredients) ? meal.ingredients.length : 0} ingredient mappings</p>
            <p>
              {image
                ? 'Linked photo; availability is checked when displayed.'
                : 'No image URL. A KAINARA placeholder will be used.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 py-12 text-sm leading-relaxed text-brand-muted">
          <p className="font-semibold text-brand-text">
            {parsed.invalid ? 'Finish the JSON to see your meals' : 'Your meals will appear here'}
          </p>
          <p className="mt-2">Upload a JSON file, paste a batch or insert the template to start.</p>
        </div>
      )}
    </aside>
  );
}

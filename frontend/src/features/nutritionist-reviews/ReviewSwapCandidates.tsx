'use client';
import MealImage from '@/components/user/MealImage';
import Button from '@/components/ui/Button';
import { Check } from '@/components/ui/icons';
import { formatMealTitle } from '@/lib/meal-title';
import type { SwapOption } from './useReviewSwap';
import type { PublicVerifier } from '@/types';

export default function ReviewSwapCandidates({ options, selectedId, busy, onSelect, onVerifier }: {
  options: SwapOption[]; selectedId?: string; busy: boolean;
  onSelect: (id: string) => void; onVerifier: (verifier: PublicVerifier) => void;
}) {
  return <ul aria-label="Replacement candidates" className="divide-y divide-brand-border/70">
    {options.map(option => <li key={option.id} className="py-2">
      <button type="button" disabled={busy} aria-pressed={selectedId === option.id}
        onClick={() => onSelect(option.id)} aria-label={`Select ${formatMealTitle(option.mealName)}`}
        className={`flex w-full items-start gap-3 rounded-xl p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-green disabled:opacity-50 ${selectedId === option.id ? 'bg-brand-green/10' : 'hover:bg-brand-bgAlt'}`}>
        <MealImage image={option.image} mealName={option.mealName} mealType={option.mealType} variant="thumbnail"
          className="!h-12 !w-12 shrink-0 !rounded-xl object-cover" />
        <span className="min-w-0 flex-1">
          <span className="block break-words font-display text-base font-semibold leading-5 text-brand-text">{formatMealTitle(option.mealName)}</span>
          <span className="mt-1 block text-xs tabular-nums text-brand-muted">{Math.round(option.calories)} kcal · {Math.round(option.proteinG)} g protein</span>
          <span className="mt-1 block text-xs text-brand-muted">{option.pairedRiceG ? `Includes ${Math.round(option.pairedRiceG)} g rice` : 'One meal serving'}</span>
        </span>
        {selectedId === option.id && <Check aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-brand-green" />}
      </button>
      {option.verifier && <Button variant="ghost" size="sm" className="ml-16 !min-h-8 !px-2 !py-1 text-xs"
        disabled={busy} onClick={() => onVerifier(option.verifier!)}>View recipe reviewer</Button>}
    </li>)}
  </ul>;
}

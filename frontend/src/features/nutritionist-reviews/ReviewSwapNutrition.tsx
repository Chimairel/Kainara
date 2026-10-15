import SwapNutritionTable, { type SwapNutritionValues } from '@/features/meals/SwapNutritionTable';
import { REVIEW_NUTRIENT_FIELDS, type NutrientFilters } from './ReviewNutrientFilters';
import ReviewDayProjection from './ReviewDayProjection';
import type { ReviewNutritionTargets } from './review-nutrition-targets';
import type { ReactNode } from 'react';
import { formatNutritionNumber as amount } from '@/lib/nutrition-number';

const operators: Record<string, string> = {
  LESS_THAN: '<', LESS_THAN_OR_EQUAL: '≤', GREATER_THAN: '>', GREATER_THAN_OR_EQUAL: '≥', EQUAL: '=',
};
/** Daily policy references and per-meal search limits are distinct from meal facts. */
export default function ReviewSwapNutrition({ before, after, targets, filters = {} }: {
  before: SwapNutritionValues; after: SwapNutritionValues; targets?: ReviewNutritionTargets; filters?: NutrientFilters;
}) {
  const macroTargets = Object.fromEntries(REVIEW_NUTRIENT_FIELDS.slice(0, 4).map(([key, , unit]) => {
    const range = key === 'calories' ? targets?.mealEnergyRange :
      key === 'proteinG' || key === 'carbsG' || key === 'fatG' ? targets?.ranges?.[key] : undefined;
    return [key, range ? <span className="whitespace-nowrap font-semibold">{amount(range.minimum)}–{amount(range.maximum)} {unit}</span> : 'Not set'];
  }));
  const macroRules = targets?.rules.filter(rule => ['proteinG', 'carbsG', 'fatG'].includes(rule.nutrient) && operators[rule.operator]) ?? [];
  const clinicalTargets: Partial<Record<keyof SwapNutritionValues, ReactNode>> = {};
  for (const [key, , unit] of REVIEW_NUTRIENT_FIELDS.slice(4)) {
    const rules = targets?.rules.filter(rule => rule.nutrient === key && operators[rule.operator]) ?? [];
    const filter = filters[key];
    const guidance = targets?.guidance?.find(item => item.nutrient === key);
    clinicalTargets[key] = <div className="space-y-1 text-xs leading-5">
      {rules.map((rule, index) => <p key={index} title={`${rule.condition.replaceAll('_', ' ')} · ${rule.sourceTitle}`}>
        <span className="whitespace-nowrap font-semibold">{operators[rule.operator]} {amount(rule.value)} {rule.unit}</span>
        <span className="block text-brand-muted">Approved rule</span>
      </p>)}
      {!rules.length && (guidance ? <p title={guidance.explanation}>
        <span className="font-semibold">{guidance.value}</span>
        <span className="block text-brand-muted">Guidance reference</span>
      </p> : <span className="text-brand-muted">Not set</span>)}
      {filter && <p className="text-brand-muted">
        Search: {filter.min !== undefined && filter.min === filter.max && !filter.minExclusive && !filter.maxExclusive
          ? `= ${amount(filter.min)} ${unit}`
          : <>{filter.min !== undefined && `${filter.minExclusive ? '>' : '≥'} ${amount(filter.min)} ${unit}`}
            {filter.min !== undefined && filter.max !== undefined && ' · '}
            {filter.max !== undefined && `${filter.maxExclusive ? '<' : '≤'} ${amount(filter.max)} ${unit}`}</>} / meal
      </p>}
    </div>;
  }
  return <section aria-label="Meal nutrition comparison" className="space-y-5">
    <div>
      <h3 className="font-display text-base font-bold">Calories & macros</h3>
      <p className="mt-1 text-xs leading-5 text-brand-muted">One meal, including rice. Ranges allocate the saved daily guidance{targets?.mealShare ? ` (${Math.round(targets.mealShare * 100)}% for this meal)` : ''}.</p>
      <SwapNutritionTable before={before} after={after} fields={REVIEW_NUTRIENT_FIELDS.slice(0, 4)}
        beforeLabel="Current" afterLabel="Replacement" targets={macroTargets} targetLabel="Meal planning range" compact={false} />
      {macroRules.length > 0 && <ul aria-label="Recorded macro limits" className="mt-3 space-y-1 text-xs text-brand-muted">
        {macroRules.map((rule, index) => <li key={index}>Approved rule · {REVIEW_NUTRIENT_FIELDS.find(([key]) => key === rule.nutrient)?.[1]} {operators[rule.operator]} {amount(rule.value)} {rule.unit}</li>)}
      </ul>}
    </div>
    <ReviewDayProjection after={after} targets={targets} />
    <div>
      <h3 className="font-display text-base font-bold">Other nutrients</h3>
      <p className="mt-1 text-xs leading-5 text-brand-muted">Daily limits cover the whole day; they are not a per-meal allowance.</p>
      <SwapNutritionTable before={before} after={after} fields={REVIEW_NUTRIENT_FIELDS.slice(4)}
        beforeLabel="Current" afterLabel="Replacement" targets={clinicalTargets} compact={false} />
    </div>
    <details className="border-t border-brand-border/60 pt-3 text-xs text-brand-muted">
      <summary className="cursor-pointer font-semibold text-brand-text">Target details & sources</summary>
      <div className="mt-3 space-y-3 leading-5">
        <p>Meal allocation: breakfast 30%, lunch 40%, dinner 30%. Macro ranges are derived planning references. The energy range uses the existing meal calorie tolerance.</p>
        {targets?.meal && <p>Meal planning point: {REVIEW_NUTRIENT_FIELDS.slice(0, 4).map(([key, label, unit]) => {
          const value = targets.meal![key as keyof NonNullable<ReviewNutritionTargets['meal']>];
          return typeof value === 'number' ? `${label} ${amount(value)} ${unit}` : null;
        }).filter(Boolean).join(' · ')}.</p>}
        {targets?.daily ? <p>Daily planning point: {amount(targets.daily.calories!)} kcal · {amount(targets.daily.proteinG!)} g protein · {amount(targets.daily.carbsG!)} g carbs · {amount(targets.daily.fatG!)} g fat.</p>
          : <p>No saved planning target is available.</p>}
        {targets?.daily?.explanation && <p>{targets.daily.explanation}</p>}
        {targets?.rules.map((rule, index) => <p key={index}>
          {rule.condition.replaceAll('_', ' ')}: {operators[rule.operator] ?? rule.operator} {amount(rule.value)} {rule.unit}.{' '}
          <a href={/^https?:\/\//.test(rule.sourceUrl) ? rule.sourceUrl : undefined} target="_blank" rel="noopener noreferrer" className="text-brand-green underline underline-offset-4">{rule.sourceTitle}</a>
        </p>)}
        {targets?.guidance?.map(item => <p key={item.nutrient}>
          {item.value}: {item.explanation}{' '}<a href={/^https?:\/\//.test(item.sourceUrl) ? item.sourceUrl : undefined} target="_blank" rel="noopener noreferrer" className="text-brand-green underline underline-offset-4">{item.sourceTitle}</a>
        </p>)}
        <p>Guidance references come from the member’s saved report; they are not individual prescriptions. Not set means no active recorded target. Search limits only filter candidates. Missing meal values are not recorded, not zero.</p>
      </div>
    </details>
  </section>;
}

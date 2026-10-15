import SwapNutritionTable, { type SwapNutritionValues } from '@/features/meals/SwapNutritionTable';
import { REVIEW_NUTRIENT_FIELDS, type NutrientFilters } from './ReviewNutrientFilters';
import type { ReviewNutritionTargets } from './review-nutrition-targets';
import type { ReactNode } from 'react';

const operators: Record<string, string> = {
  LESS_THAN: '<', LESS_THAN_OR_EQUAL: '≤', GREATER_THAN: '>', GREATER_THAN_OR_EQUAL: '≥', EQUAL: '=',
};
const amount = (value: number) => Math.round(value * 10) / 10;
/** Daily policy references and per-meal search limits are distinct from meal facts. */
export default function ReviewSwapNutrition({ before, after, targets, filters = {} }: {
  before: SwapNutritionValues; after: SwapNutritionValues; targets?: ReviewNutritionTargets; filters?: NutrientFilters;
}) {
  const macroTargets = Object.fromEntries(REVIEW_NUTRIENT_FIELDS.slice(0, 4).map(([key, , unit]) => {
    const point = targets?.meal?.[key as keyof NonNullable<ReviewNutritionTargets['meal']>];
    const guidance = targets?.guidance?.find(item => item.nutrient === key);
    const rules = targets?.rules.filter(rule => rule.nutrient === key && operators[rule.operator]) ?? [];
    if (!guidance && !rules.length && typeof point !== 'number') return [key, 'Not set'];
    return [key, <div key={key} className="space-y-1 text-xs leading-5">
      {rules.map((rule, index) => <p key={index} title={`${rule.condition.replaceAll('_', ' ')} · ${rule.sourceTitle}`}>
        <span className="font-semibold">{operators[rule.operator]} {amount(rule.value)} {rule.unit}</span>
        <span className="block text-brand-muted">Approved rule</span>
      </p>)}
      {guidance && <p title={guidance.explanation}>
        <span className="font-semibold">{guidance.value}</span>
        <span className="block text-brand-muted">Saved daily reference</span>
      </p>}
      {!guidance && !rules.length && key !== 'calories' && <p className="text-brand-muted">No saved range</p>}
      {typeof point === 'number' && <p className="text-brand-muted">Planning point: <span className="whitespace-nowrap">{amount(point)} {unit}/meal</span></p>}
    </div>];
  }));
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
        Search: {filter.min !== undefined && `${filter.minExclusive ? '>' : '≥'} ${filter.min} ${unit}`}
        {filter.min !== undefined && filter.max !== undefined && ' · '}
        {filter.max !== undefined && `${filter.maxExclusive ? '<' : '≤'} ${filter.max} ${unit}`} / meal
      </p>}
    </div>;
  }
  return <section aria-label="Meal nutrition comparison" className="space-y-5">
    <div>
      <h3 className="font-display text-base font-bold">Calories & macros</h3>
      <p className="mt-1 text-xs leading-5 text-brand-muted">Current and replacement values are per meal, including rice. Reference ranges cover the full day; planning points use the saved meal allocation.</p>
      <SwapNutritionTable before={before} after={after} fields={REVIEW_NUTRIENT_FIELDS.slice(0, 4)}
        beforeLabel="Current" afterLabel="Replacement" targets={macroTargets} targetLabel="Reference / target" compact={false} />
    </div>
    <div>
      <h3 className="font-display text-base font-bold">Other nutrients</h3>
      <p className="mt-1 text-xs leading-5 text-brand-muted">Daily limits cover the whole day; they are not a per-meal allowance.</p>
      <SwapNutritionTable before={before} after={after} fields={REVIEW_NUTRIENT_FIELDS.slice(4)}
        beforeLabel="Current" afterLabel="Replacement" targets={clinicalTargets} compact={false} />
    </div>
    <details className="border-t border-brand-border/60 pt-3 text-xs text-brand-muted">
      <summary className="cursor-pointer font-semibold text-brand-text">Target details & sources</summary>
      <div className="mt-3 space-y-3 leading-5">
        {targets?.daily ? <p>Daily planning point: {amount(targets.daily.calories!)} kcal · {amount(targets.daily.proteinG!)} g protein · {amount(targets.daily.carbsG!)} g carbs · {amount(targets.daily.fatG!)} g fat.</p>
          : <p>No saved planning target is available.</p>}
        {targets?.daily?.explanation && <p>{targets.daily.explanation}</p>}
        {targets?.rules.map((rule, index) => <p key={index}>
          {rule.condition.replaceAll('_', ' ')}: {operators[rule.operator] ?? rule.operator} {amount(rule.value)} {rule.unit}.{' '}
          <a href={/^https?:\/\//.test(rule.sourceUrl) ? rule.sourceUrl : undefined} target="_blank" rel="noopener noreferrer" className="text-brand-green underline underline-offset-4">{rule.sourceTitle}</a>
        </p>)}
        {targets?.guidance?.map(item => <p key={item.nutrient}>
          {item.explanation}{' '}<a href={/^https?:\/\//.test(item.sourceUrl) ? item.sourceUrl : undefined} target="_blank" rel="noopener noreferrer" className="text-brand-green underline underline-offset-4">{item.sourceTitle}</a>
        </p>)}
        <p>Guidance references come from the member’s saved report; they are not individual prescriptions. Not set means no active recorded target. Search limits only filter candidates. Missing meal values are not recorded, not zero.</p>
      </div>
    </details>
  </section>;
}

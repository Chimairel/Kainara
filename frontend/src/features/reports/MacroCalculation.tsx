import type { NutritionReport } from '@/types';

export default function MacroCalculation({ targets }: { targets: NutritionReport['planningTargets'] }) {
  if (!targets) return null;
  const amount = (value: number) => value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  return <section aria-label="Macro calculations" className="space-y-2 py-4 text-[13px] leading-relaxed text-slate-700">
    <h2 className="text-base font-bold text-[#1B4332]">How the macro estimates are calculated</h2>
    {([['Protein', targets.proteinG, 4], ['Fat', targets.fatG, 9], ['Carbohydrate', targets.carbsG, 4]] as const).map(([label, grams, factor]) => {
      const energy = grams * factor;
      return <p key={label}><strong>{label}:</strong> {amount(targets.calories)} kcal × {amount(energy / targets.calories * 100)}% ÷ {factor} kcal/g = <strong>{amount(grams)} g/day</strong>.</p>;
    })}
    <p className="text-xs text-slate-600">Protein and carbohydrate provide 4 kcal/g; fat provides 9 kcal/g. Percentages are shown rounded from this version’s saved estimates.
      {targets.basis === 'REVIEW_REFERENCE' ? ' These planning references are not individualized condition-specific limits; your RND may set different limits.' : ''}</p>
    {targets.explanation && <p className="text-xs text-slate-600">{targets.explanation}</p>}
  </section>;
}

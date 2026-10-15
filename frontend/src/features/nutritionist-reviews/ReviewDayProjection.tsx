import type { SwapNutritionValues } from '@/features/meals/SwapNutritionTable';
import type { ReviewNutritionTargets } from './review-nutrition-targets';
import { formatNutritionNumber as amount } from '@/lib/nutrition-number';

const fields = [['calories', 'Energy', 'kcal'], ['proteinG', 'Protein', 'g'], ['carbsG', 'Carbohydrates', 'g'], ['fatG', 'Fat', 'g']] as const;
const recorded = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export default function ReviewDayProjection({ after, targets }: { after: SwapNutritionValues; targets?: ReviewNutritionTargets }) {
  const day = targets?.plannedDay;
  const state = !day || !day.otherTotals ? 'Unavailable' : !day.complete ? 'Incomplete day' : 'All 3 meals included';
  return <details className="border-t border-brand-border/60 pt-3 text-sm">
    <summary className="cursor-pointer font-semibold">Planned day after swap <span className="ml-2 text-xs font-normal text-brand-muted">{state}</span></summary>
    <p className="mt-3 text-xs leading-5 text-brand-muted">Other scheduled meals at review load plus this replacement, including pending meals. Outside food is not included.</p>
    {day?.ambiguous && <p className="mt-2 text-xs text-brand-muted">Competing meals occupy the same slot. Daily totals cannot be calculated reliably.</p>}
    {!!day?.missingMealTypes.length && <p className="mt-2 text-xs text-brand-muted">Missing: {day.missingMealTypes.map(type => type.toLowerCase()).join(', ')}. Totals below cover recorded meals only.</p>}
    <div className="mt-3 overflow-x-auto">
      <table aria-label="Projected daily nutrition" className="w-full text-left text-xs tabular-nums">
        <thead className="border-b border-brand-border text-brand-muted"><tr>
          {['Nutrient', 'After swap', 'Daily reference', 'Check'].map(label => <th key={label} scope="col" className="py-2 pr-3 font-semibold">{label}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-brand-border/30">{fields.map(([key, label, unit]) => {
          const other = day?.otherTotals?.[key], replacement = after[key];
          const total = recorded(other) && recorded(replacement) ? other + replacement : null;
          const range = key === 'calories' ? undefined : targets?.ranges?.[key];
          const check = total === null ? 'Unavailable' : !day?.complete ? 'Incomplete day' : !range ? 'No range' : total < range.dailyMinimum ? 'Below range' : total > range.dailyMaximum ? 'Above range' : 'Within range';
          return <tr key={key}>
            <th scope="row" className="py-2 pr-3 font-semibold">{label}</th>
            <td className="whitespace-nowrap py-2 pr-3">{total === null ? 'Not available' : `${amount(total)} ${unit}`}</td>
            <td className="py-2 pr-3 text-brand-muted">{range ? `${amount(range.dailyMinimum)}–${amount(range.dailyMaximum)} ${unit}` : key === 'calories' && recorded(targets?.daily?.calories) ? `${amount(targets.daily.calories)} kcal planning point` : 'Not set'}</td>
            <td className={`py-2 ${check === 'Within range' ? 'text-brand-green' : 'text-brand-muted'}`}>{check}</td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </details>;
}

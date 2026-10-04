import type { SwapNutritionAnalysis } from './meals-workspace.types';
import { swapNutritionLabel } from './swap-nutrition-label';

type GroceryChange = { ingredientName: string; unit: string | null };
export default function SwapImpactDetails({
  analysis,
  additions,
  removals,
}: {
  analysis?: SwapNutritionAnalysis;
  additions: (GroceryChange & { additionalQuantity: number | null; remainingQuantity: number | null })[];
  removals: (GroceryChange & { removableQuantity: number | null })[];
}) {
  const amount = (quantity: number | null, unit: string | null) =>
    quantity === null ? 'quantity needs checking' : `${Number(quantity.toFixed(2))}${unit ? ` ${unit}` : ''}`;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
      {analysis?.target && (
        <section
          aria-label="Daily nutrition comparison"
          className="flex flex-col justify-between rounded-2xl border border-brand-border/70 bg-brand-surface/70 dark:bg-brand-surface/30 p-3 shadow-2xs"
        >
          <div>
            <div className="flex items-start justify-between gap-2 border-b border-brand-border/40 pb-2">
              <h3 className="font-display text-xs font-bold text-brand-text">
                Planned day compared with report estimates
              </h3>
              {analysis.nutritionMatch && (
                <span className="rounded-full bg-brand-bgAlt border border-brand-border/60 px-2 py-0.5 font-mono text-[9px] font-bold text-brand-text shrink-0">
                  {swapNutritionLabel(analysis.nutritionMatch)}
                </span>
              )}
            </div>
            {analysis.completeDay && Boolean(analysis.macroChanges?.length) && (
              <ul aria-label="Effect on daily macros" className="mt-2 space-y-1 text-[11px] text-brand-muted">
                {analysis.macroChanges?.map((change) => (
                  <li key={change.nutrient} className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-brand-green/70 shrink-0" />
                    <span>
                      {{ proteinG: 'Protein', carbsG: 'Carbs', fatG: 'Fat' }[change.nutrient]}:{' '}
                      {
                        {
                          CLOSER: 'closer to target',
                          FURTHER: 'further from target',
                          UNCHANGED: 'distance from target unchanged',
                        }[change.direction]
                      }
                      {' · '}
                      {
                        { WITHIN_ESTIMATE: 'within the planning range', ABOVE: 'above target', BELOW: 'below target' }[
                          change.status
                        ]
                      }
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-left text-[10px] font-mono border-collapse">
                <thead>
                  <tr className="border-b border-brand-border/50 text-[9px] uppercase tracking-wider text-brand-muted">
                    <th className="py-1 pr-2 font-bold">Nutrient</th>
                    <th className="py-1 px-2 font-bold">Before</th>
                    <th className="py-1 px-2 font-bold">After</th>
                    <th className="py-1 pl-2 font-bold">Estimate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-border/30">
                  {(
                    [
                      ['calories', 'Energy', 'kcal'],
                      ['proteinG', 'Protein', 'g'],
                      ['carbsG', 'Carbs', 'g'],
                      ['fatG', 'Fat', 'g'],
                    ] as const
                  ).map(([key, label, unit]) => (
                    <tr key={key} className="hover:bg-brand-bgAlt/40">
                      <th className="py-1 pr-2 font-semibold text-brand-text">{label}</th>
                      <td className="py-1 px-2 text-brand-muted">
                        {Math.round(analysis.before[key])} {unit}
                      </td>
                      <td className="py-1 px-2 font-bold text-brand-text">
                        {Math.round(analysis.after[key])} {unit}
                      </td>
                      <td className="py-1 pl-2 text-brand-muted">
                        {Math.round(analysis.target![key])} {unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!analysis.completeDay && (
              <p className="mt-2 text-[11px] text-brand-muted">
                This day has missing or unavailable meals. These are the available planned totals.
              </p>
            )}
            {analysis.warnings.length > 0 && (
              <ul className="mt-2 space-y-1 text-[11px] text-amber-700 dark:text-amber-300">
                {analysis.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-2.5 pt-2 border-t border-brand-border/40 text-[10px] text-brand-muted leading-tight">
            Planning estimates guide selection; matching calories alone does not mean the day is balanced. Logged
            outside food is tracked separately.
          </p>
        </section>
      )}
      <section
        aria-label="Grocery changes"
        className={`flex flex-col justify-between rounded-2xl border border-brand-border/70 bg-brand-surface/70 dark:bg-brand-surface/30 p-3 shadow-2xs ${
          !analysis?.target ? 'md:col-span-2' : ''
        }`}
      >
        <div>
          <div className="flex items-center justify-between gap-2 border-b border-brand-border/40 pb-2">
            <h3 className="font-display text-xs font-bold text-brand-text">Grocery changes</h3>
            <span className="text-[10px] font-mono text-brand-muted">
              {additions.length === 0 && removals.length === 0
                ? 'No changes'
                : `${additions.length + removals.length} item${additions.length + removals.length === 1 ? '' : 's'}`}
            </span>
          </div>
          {additions.length === 0 && removals.length === 0 ? (
            <p className="mt-3 text-xs text-brand-muted">No changes to remaining groceries.</p>
          ) : (
            <div className="space-y-2 mt-2">
              {additions.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">Add to shopping</p>
                  <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-[11px]">
                    {additions.map((item, i) => (
                      <li key={`${item.ingredientName}-${item.unit}-${i}`} className="text-brand-text">
                        {item.ingredientName}: +{amount(item.additionalQuantity, item.unit)}
                        {item.remainingQuantity !== null && (
                          <span className="text-brand-muted">
                            {' '}
                            · {amount(item.remainingQuantity, item.unit)} left to buy
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {removals.length > 0 && (
                <div>
                  <p className="text-[11px] font-bold text-rose-700 dark:text-rose-400">Reduce remaining shopping</p>
                  <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-[11px]">
                    {removals.map((item, i) => (
                      <li key={`${item.ingredientName}-${item.unit}-${i}`} className="text-brand-text">
                        {item.ingredientName}: −{amount(item.removableQuantity, item.unit)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="mt-2.5 pt-2 border-t border-brand-border/40 text-[10px] text-brand-muted leading-tight">
          Purchased quantities stay recorded.
        </p>
      </section>
    </div>
  );
}

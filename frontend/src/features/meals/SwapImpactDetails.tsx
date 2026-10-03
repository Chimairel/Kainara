import type { SwapNutritionAnalysis } from './meals-workspace.types';

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
    <div className="space-y-3 text-xs">
      {analysis?.target && (
        <section aria-label="Daily nutrition comparison" className="rounded-lg border border-brand-border/60 p-2">
          <h3 className="font-bold">Planned day compared with report estimates</h3>
          <div className="overflow-x-auto">
            <table className="mt-2 w-full text-left text-[10px]">
              <thead>
                <tr>
                  <th>Nutrient</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Estimate</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['calories', 'Energy', 'kcal'],
                    ['proteinG', 'Protein', 'g'],
                    ['carbsG', 'Carbs', 'g'],
                    ['fatG', 'Fat', 'g'],
                  ] as const
                ).map(([key, label, unit]) => (
                  <tr key={key}>
                    <th className="py-1 font-medium">{label}</th>
                    <td>
                      {Math.round(analysis.before[key])} {unit}
                    </td>
                    <td>
                      {Math.round(analysis.after[key])} {unit}
                    </td>
                    <td>
                      {Math.round(analysis.target![key])} {unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!analysis.completeDay && (
            <p className="mt-2 text-brand-muted">
              This day has missing or unavailable meals. These are the available planned totals.
            </p>
          )}
          {analysis.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-amber-700 dark:text-amber-300">
              {analysis.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-brand-muted">
            Planning estimates guide selection; matching calories alone does not mean the day is balanced. Logged
            outside food is tracked separately.
          </p>
        </section>
      )}
      <section aria-label="Grocery changes" className="rounded-lg border border-brand-border/60 p-2">
        <h3 className="font-bold">Grocery changes</h3>
        {additions.length === 0 && removals.length === 0 ? (
          <p className="mt-1 text-brand-muted">No changes to remaining groceries.</p>
        ) : (
          <>
            {additions.length > 0 && (
              <>
                <p className="mt-2 font-semibold">Add to shopping</p>
                <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                  {additions.map((item, i) => (
                    <li key={`${item.ingredientName}-${item.unit}-${i}`}>
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
              </>
            )}
            {removals.length > 0 && (
              <>
                <p className="mt-2 font-semibold">Reduce remaining shopping</p>
                <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
                  {removals.map((item, i) => (
                    <li key={`${item.ingredientName}-${item.unit}-${i}`}>
                      {item.ingredientName}: −{amount(item.removableQuantity, item.unit)}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="mt-2 text-brand-muted">Purchased quantities stay recorded.</p>
          </>
        )}
      </section>
    </div>
  );
}

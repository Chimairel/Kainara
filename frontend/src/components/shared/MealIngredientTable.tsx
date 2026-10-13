export type MealIngredientRow = {
  name: string;
  quantity?: number | null;
  unit?: string | null;
  source: string;
  compositionFoodName?: string | null;
};

/** Read-only recorded ingredient evidence, shared by member and staff meal views. */
export default function MealIngredientTable({ ingredients }: { ingredients: MealIngredientRow[] }) {
  return (
    <div className="max-w-full overflow-x-auto" role="region" aria-label="Ingredient table scroll area" tabIndex={0}>
      <table className="w-full min-w-[32rem] border-collapse text-left text-sm" aria-label="Meal ingredients">
        <thead>
          <tr className="border-b border-brand-border text-brand-muted">
            {['Ingredient', 'Amount', 'Unit', 'Nutrition reference'].map((label) => (
              <th key={label} scope="col" className={`p-2 font-semibold ${label === 'Amount' || label === 'Unit' ? 'w-px whitespace-nowrap [overflow-wrap:normal]' : 'break-words'}`}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ingredients.map((ingredient, index) => {
            return (
              <tr key={index} className="border-b border-brand-border align-top">
                <td className="p-2 font-medium">{ingredient.name}</td>
                <td className="whitespace-nowrap p-2 tabular-nums [overflow-wrap:normal]">{ingredient.quantity ?? 'Not recorded'}</td>
                <td className="whitespace-nowrap p-2 [overflow-wrap:normal]">{ingredient.unit || 'Not recorded'}</td>
                <td className="p-2 text-xs text-brand-muted">
                  {(
                    {
                      FNRI: 'FNRI',
                      USDA_FDC: 'USDA',
                      SOURCE_RECIPE: 'Source recipe',
                      GEMINI_ESTIMATED: 'AI estimate',
                    } as Record<string, string>
                  )[ingredient.source] ?? 'Not recorded'}
                  {ingredient.compositionFoodName && <span className="block mt-1">{ingredient.compositionFoodName}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

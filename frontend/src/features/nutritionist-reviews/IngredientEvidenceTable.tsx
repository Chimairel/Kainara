import type { DetailData } from './useNutritionistReviews';

type Ingredient = Omit<DetailData['ingredients'][number], 'source'> & { source: string };
export default function IngredientEvidenceTable({ ingredients }: { ingredients: Ingredient[] }) {
  return (
    <table className="w-full border-collapse text-left text-sm" aria-label="Meal ingredients">
      <thead>
        <tr className="border-b border-brand-border text-brand-muted">
          {['Ingredient', 'Amount', 'Unit', 'Nutrition reference'].map((label) => (
            <th key={label} className="p-2 font-semibold">
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
              <td className="p-2 tabular-nums">{ingredient.quantity ?? 'Not recorded'}</td>
              <td className="p-2">{ingredient.unit || 'Not recorded'}</td>
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
  );
}

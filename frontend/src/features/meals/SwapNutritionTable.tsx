import type { ReactNode } from 'react';

export type SwapNutritionValues = Partial<Record<
  'calories' | 'proteinG' | 'carbsG' | 'fatG' | 'sodiumMg' | 'sugarG' | 'fiberG' |
  'potassiumMg' | 'phosphorusMg' | 'saturatedFatG', number | null
>>;

const macroFields = [
  ['calories', 'Energy', 'kcal'], ['proteinG', 'Protein', 'g'],
  ['carbsG', 'Carbs', 'g'], ['fatG', 'Fat', 'g'],
] as const;

/** Shared member/RND nutrition table; callers supply the serving or day totals. */
export default function SwapNutritionTable({
  before, after, estimate, fields = macroFields, beforeLabel = 'Before', afterLabel = 'After',
  showChange = false, compact = true,
  targets, targetLabel = 'Target',
}: {
  before: SwapNutritionValues;
  after: SwapNutritionValues;
  estimate?: SwapNutritionValues;
  fields?: ReadonlyArray<readonly [keyof SwapNutritionValues, string, string]>;
  beforeLabel?: string;
  afterLabel?: string;
  showChange?: boolean;
  compact?: boolean;
  targets?: Partial<Record<keyof SwapNutritionValues, ReactNode>>;
  targetLabel?: string;
}) {
  const recorded = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const round = (value: number) => compact ? Math.round(value) : Math.round(value * 10) / 10;
  const amount = (value: number | null | undefined, unit: string) =>
    recorded(value) ? `${round(value)} ${unit}` : 'Not recorded';
  const cell = compact ? 'py-1' : 'py-2.5';
  return (
    <div className="overflow-x-auto mt-2">
      <table className={`w-full border-collapse text-left tabular-nums ${compact ? 'text-[10px] font-mono' : 'text-sm'}`}>
        <thead>
          <tr className={`border-b border-brand-border/50 text-brand-muted ${compact ? 'text-[9px] uppercase tracking-wider' : 'text-xs'}`}>
            <th scope="col" className={`${cell} pr-3 font-bold`}>Nutrient</th>
            <th scope="col" className={`${cell} px-3 font-bold`}>{beforeLabel}</th>
            <th scope="col" className={`${cell} px-3 font-bold`}>{afterLabel}</th>
            {estimate && <th scope="col" className={`${cell} pl-3 font-bold`}>Estimate</th>}
            {showChange && <th scope="col" className={`${cell} pl-3 font-bold`}>Change</th>}
            {targets && <th scope="col" className={`${cell} pl-3 font-bold`}>{targetLabel}</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-border/30">
          {fields.map(([key, label, unit]) => {
            const current = before[key], replacement = after[key];
            const delta = recorded(current) && recorded(replacement) ? round(replacement - current) : null;
            return (
              <tr key={key} className="hover:bg-brand-bgAlt/40">
                <th scope="row" className={`${cell} pr-3 font-semibold text-brand-text`}>{label}</th>
                <td className={`${cell} whitespace-nowrap px-3 text-brand-muted`}>{amount(current, unit)}</td>
                <td className={`${cell} whitespace-nowrap px-3 font-bold text-brand-text`}>{amount(replacement, unit)}</td>
                {estimate && <td className={`${cell} whitespace-nowrap pl-3 text-brand-muted`}>{amount(estimate[key], unit)}</td>}
                {showChange && <td className={`${cell} whitespace-nowrap pl-3 text-brand-muted`}>
                  {delta === null ? 'Not recorded' : `${delta > 0 ? '+' : ''}${delta} ${unit}`}
                </td>}
                {targets && <td className={`${cell} pl-3 text-brand-text`}>{targets[key] ?? 'Not set'}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

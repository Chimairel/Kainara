import { cn } from '@/lib/utils';

export function MealMacros({
  calories,
  proteinG,
  carbsG,
  fatG,
  className,
  variant = 'pills',
}: {
  calories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  className?: string;
  variant?: 'pills' | 'line';
}) {
  const values = [
    {
      value: calories,
      unit: ' kcal',
      label: 'Energy',
      color: 'border-black/10 bg-black/[0.04] text-brand-text dark:border-white/10 dark:bg-white/[0.06]',
    },
    {
      value: proteinG,
      unit: variant === 'line' ? 'g protein' : 'g P',
      label: 'Protein',
      color:
        'border-[#08705b]/20 bg-[#08705b]/10 text-[#08705b] dark:border-[#10b981]/30 dark:bg-[#10b981]/15 dark:text-[#34d399]',
    },
    {
      value: carbsG,
      unit: variant === 'line' ? 'g carbs' : 'g C',
      label: 'Carbohydrates',
      color:
        'border-[#18b9d2]/20 bg-[#18b9d2]/10 text-[#0b7788] dark:border-[#38bdf8]/30 dark:bg-[#38bdf8]/15 dark:text-[#38bdf8]',
    },
    {
      value: fatG,
      unit: variant === 'line' ? 'g fat' : 'g F',
      label: 'Fat',
      color:
        'border-[#eb6a38]/20 bg-[#eb6a38]/10 text-[#c74614] dark:border-[#eb6a38]/30 dark:bg-[#eb6a38]/15 dark:text-[#f09e6c]',
    },
  ].filter((item) => item.value != null);
  return (
    <div
      className={cn(
        variant === 'line'
          ? 'flex flex-wrap gap-x-1 text-xs font-medium text-white/90'
          : 'flex flex-wrap items-center gap-1.5 text-[11px] font-bold sm:gap-2',
        className
      )}
    >
      {values.map((item, i) => (
        <span
          key={item.label}
          className={
            variant === 'pills'
              ? cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1', item.color)
              : undefined
          }
        >
          {variant === 'line' && i > 0 && <span aria-hidden="true">· </span>}
          {variant === 'pills' && item.label === 'Energy' && (
            <span aria-hidden="true" className="text-[10px]">
              🔥
            </span>
          )}
          {variant === 'line' ? (
            <strong className="font-bold text-white">
              {Math.round(item.value!)}
              {item.label === 'Energy' ? '' : 'g'}
            </strong>
          ) : (
            Math.round(item.value!)
          )}
          {variant === 'line' ? item.unit.replace(/^g/, ' ') : item.unit}
        </span>
      ))}
    </div>
  );
}

type HistoryDaySummaryProps = {
  activeDay: {
    weekday: string;
    dateStr: string;
    mealCount: number;
    totalCalories: number;
    totalProtein: number;
    totalCarbs: number;
    totalFat: number;
  };
  unloggedCount: number;
};

export default function HistoryDaySummary({ activeDay, unloggedCount }: HistoryDaySummaryProps) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-[24px] border border-brand-border/70 bg-brand-surface p-4 sm:p-5 shadow-sm md:flex-row md:items-center dark:border-[#173e33] dark:bg-[#0e271f]">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-extrabold text-brand-green dark:text-brand-accent font-display uppercase tracking-wider">
            {activeDay.weekday}
          </span>
          <span className="text-xs font-semibold text-brand-muted dark:text-white/40">·</span>
          <span className="text-xs font-bold text-brand-text dark:text-white/80">{activeDay.dateStr}</span>
        </div>
        <p className="text-xs text-brand-muted dark:text-white/40 mt-0.5">
          {activeDay.mealCount} meal{activeDay.mealCount !== 1 ? 's' : ''} logged
          {unloggedCount > 0 ? ` · ${unloggedCount} planned awaiting log` : ''}
        </p>
      </div>

      {/* Day Macro Badges */}
      <div className="flex flex-wrap gap-2 text-xs font-bold">
        <span className="rounded-xl border border-brand-border bg-brand-bgAlt px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-brand-green dark:border-[#173e33] dark:bg-[#071914] dark:text-brand-accent">
          {Math.round(activeDay.totalCalories)} kcal
        </span>
        <span
          className="rounded-xl border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
          style={{
            backgroundColor: 'var(--macro-protein-bg)',
            borderColor: 'var(--macro-protein-border)',
            color: 'var(--macro-protein)',
          }}
        >
          {Math.round(activeDay.totalProtein)}g P
        </span>
        <span
          className="rounded-xl border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
          style={{
            backgroundColor: 'var(--macro-carbs-bg)',
            borderColor: 'var(--macro-carbs-border)',
            color: 'var(--macro-carbs)',
          }}
        >
          {Math.round(activeDay.totalCarbs)}g C
        </span>
        <span
          className="rounded-xl border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider"
          style={{
            backgroundColor: 'var(--macro-fat-bg)',
            borderColor: 'var(--macro-fat-border)',
            color: 'var(--macro-fat)',
          }}
        >
          {Math.round(activeDay.totalFat)}g F
        </span>
      </div>
    </div>
  );
}

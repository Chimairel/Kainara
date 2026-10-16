import type { NutritionReport } from '@/types';

export default function CalorieCalculation({ calculation }: { calculation: NutritionReport['calorieCalculation'] }) {
  if (!calculation)
    return (
      <p className="text-xs text-slate-600">Calorie calculation inputs were not recorded for this report version.</p>
    );
  const c = calculation;
  const signed = (n: number) => `${n < 0 ? '−' : '+'} ${Math.abs(n)}`;
  return (
    <section
      aria-label="Calorie calculation"
      className="space-y-2 border-y border-slate-200 py-4 text-[13px] leading-relaxed text-slate-700"
    >
      <h2 className="text-base font-bold text-[#1B4332]">How the daily kcal target is calculated</h2>
      <p>
        <strong>Resting energy (BMR):</strong> 10 × {c.inputs.weightKg} kg + 6.25 × {c.inputs.heightCm} cm − 5 ×{' '}
        {c.inputs.age} years {signed(c.sexTerm)} = {c.rawBmr.toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
        kcal/day.
      </p>
      <p className="text-xs text-slate-600">
        Sex coefficient:{' '}
        {c.sexTermBasis === 'FEMALE_DEFAULT'
          ? 'female default because sex was not recorded'
          : c.sexTermBasis === 'PREGNANCY_OVERRIDE'
            ? 'female equation used by the calculator for the recorded pregnancy declaration'
            : c.sexTerm === 5
              ? '+5 for the recorded male equation'
              : '−161 for the recorded female equation'}
        .
      </p>
      <p>
        <strong>Daily expenditure (TDEE):</strong> {c.rawBmr.toLocaleString('en-US', { maximumFractionDigits: 2 })} ×{' '}
        {c.activityMultiplier} ({c.inputs.activityLevel.replaceAll('_', ' ').toLowerCase()}) ={' '}
        {c.rawTdee.toLocaleString('en-US', { maximumFractionDigits: 2 })} kcal/day.
      </p>
      <p>
        <strong>Goal adjustment:</strong> {c.inputs.goal.replaceAll('_', ' ').toLowerCase()} {signed(c.goalAdjustment)}{' '}
        kcal/day. Round the adjusted result to a whole kcal, with the app’s {c.minimumDailyCalories} kcal lower bound:{' '}
        <strong>{c.dailyCalorieTarget.toLocaleString()} kcal/day</strong>.
      </p>
      <p>
        <strong>Saved report target:</strong> {c.recordedTarget?.toLocaleString() ?? 'Not recorded'} kcal/day.
        {c.recordedTarget !== null && c.recordedTarget !== c.dailyCalorieTarget
          ? ' This saved target differs from the formula estimate; the saved planning target is retained.'
          : ''}
      </p>
      <p className="text-xs text-slate-600">
        These are estimates, not measured metabolism or a prescribed calorie minimum. Pregnancy and medical needs
        require individual assessment.
      </p>
      <a
        href={c.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold text-[#08705b] underline underline-offset-2"
      >
        Mifflin–St Jeor equation · {c.sourceTitle}
      </a>
    </section>
  );
}

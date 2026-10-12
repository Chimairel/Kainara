import type { NutritionReport } from '@/types';

/** Saved educational content shared by the member document and staff evidence canvas. */
export default function FoodGuidanceSections({ guidance }: { guidance: NonNullable<NutritionReport['foodGuidance']> }) {
  return (
    <section aria-label="Food choices for your profile" className="my-8 space-y-7 text-slate-800">
      <div className="space-y-2">
        <h2 className="font-display text-xl font-bold text-[#0d2820]">Food choices for your profile</h2>
        <p className="max-w-[70ch] text-sm leading-6 text-slate-600">Based on the conditions and restrictions saved with this report. These examples help you choose food; your meal portions and RND review still apply.</p>
      </div>
      {([
        ['avoid', 'Avoid', 'No specific food exclusions are recorded. This does not rule out an unreported allergy.'],
        ['limit', 'Limit', 'No additional food-specific limits are recorded.'],
        ['choose', 'Choose more often', 'Your food choices need individual advice; see the RND discussion below.'],
        ['discuss', 'Discuss with your RND', 'Ask your RND if your condition or food restrictions change.'],
      ] as const).map(([key, heading, empty]) => (
        <section key={key} className="space-y-3">
          <h3 className="font-display text-base font-semibold text-[#0d2820]">{heading}</h3>
          {guidance[key].length ? <ul className="space-y-4">
            {guidance[key].map(item => <li key={item.name} className="max-w-[70ch] text-sm leading-6">
              <p className="font-semibold">{item.name}</p>
              <p>{item.reason}</p>
              <p className="text-slate-600">{item.tip}</p>
            </li>)}
          </ul> : <p className="text-sm leading-6 text-slate-600">{empty}</p>}
        </section>
      ))}
      <details className="border-t border-slate-200 pt-4 text-xs leading-5">
        <summary className="cursor-pointer font-semibold text-[#08705b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#08705b]">Food guidance sources</summary>
        <ul className="mt-3 space-y-2">{guidance.sources.map(source => <li key={source.code}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-[#08705b] underline underline-offset-4">{source.title}</a></li>)}</ul>
      </details>
    </section>
  );
}

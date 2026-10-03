import type { NutritionReport } from '@/types';
import { formatManilaDate } from '@/lib/manila-date';

export type GuidanceProfileSnapshot = {
  name: string;
  goal: string;
  dailyCalorieTarget: number | null;
  conditions: string[];
  foodRestrictions: string[];
};

/** The read-only paper view shared by patients and nutritionist reviewers. */
export default function NutritionGuidancePaper({
  report,
  profile,
  activePlanningVersion = report.planningContext?.activeVersion,
}: {
  report: NutritionReport;
  profile: GuidanceProfileSnapshot;
  activePlanningVersion?: number | null;
}) {
  const prepared = report.generatedAt
    ? formatManilaDate(report.generatedAt, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'Recently prepared';
  return (
    <article className="w-full max-w-3xl bg-white text-slate-900 rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_20px_45px_-15px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.06)] p-6 sm:p-12 md:p-14 font-sans leading-relaxed print:shadow-none print:p-0 print:max-w-none transition-shadow">
      <div className="border-b-2 border-slate-900 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">KAINARA · Personal record</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Nutrition Guidance</h1>
        <p className="mt-1 text-sm text-slate-600">Reference summary for the recorded profile</p>
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Version {report.version} · Prepared {prepared} ·{' '}
        {report.acknowledgedAt
          ? activePlanningVersion && activePlanningVersion !== report.version
            ? 'Previously selected for planning'
            : 'Selected for planning'
          : 'Not yet selected for planning'}
      </p>
      <section className="mt-8 border-b border-slate-200 pb-6">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Profile used for this guidance</h2>
        <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3.5 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-900">Name</dt>
            <dd className="text-slate-700 mt-0.5">{profile.name}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Goal</dt>
            <dd className="text-slate-700 mt-0.5">{profile.goal.replace(/_/g, ' ').toLowerCase()}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Estimated energy target</dt>
            <dd className="text-slate-700 mt-0.5">
              {profile.dailyCalorieTarget === null
                ? 'Not recorded'
                : `${profile.dailyCalorieTarget.toLocaleString()} kcal/day`}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900">Reported conditions</dt>
            <dd className="text-slate-700 mt-0.5">
              {profile.conditions.length ? profile.conditions.join(', ').replace(/_/g, ' ') : 'None reported'}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-semibold text-slate-900">Reported allergies, intolerances and avoided foods</dt>
            <dd className="text-slate-700 mt-0.5">
              {profile.foodRestrictions.length
                ? profile.foodRestrictions.join(', ').replace(/_/g, ' ')
                : 'None reported'}
            </dd>
          </div>
        </dl>
      </section>
      {report.planningTargets && (
        <section className="mt-7 border-b border-slate-200 pb-6" aria-label="Daily planning estimates">
          <h2 className="text-base font-bold">Daily planning estimates</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            {(
              [
                ['calories', 'Energy', 'kcal'],
                ['proteinG', 'Protein', 'g'],
                ['carbsG', 'Carbs', 'g'],
                ['fatG', 'Fat', 'g'],
              ] as const
            ).map(([key, label, unit]) => (
              <div key={key}>
                <dt className="font-semibold">{label}</dt>
                <dd>
                  {Math.round(report.planningTargets![key])} {unit}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm text-slate-600">{report.planningTargets.explanation}</p>
          <p className="mt-2 text-xs text-slate-500">
            Selecting this report supplies these estimates to meal planning and swap comparisons. Actual meal totals are
            shown separately.
          </p>
        </section>
      )}
      <section className="mt-7 border-b border-slate-200 pb-6">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">What these numbers mean</h2>
        <p className="mt-3 text-sm leading-relaxed text-slate-800">{report.generalSummary}</p>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          The energy target is a planning estimate based on the saved details. Population references below are
          calculated from that target. Conditions that need more clinical information are marked for individual review;
          the report does not assign an unsupported personal limit.
        </p>
      </section>
      <section className="mt-7 border-b border-slate-200 pb-6">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Calculated references and review notes</h2>
        <ol className="mt-3 divide-y divide-slate-200">
          {(report.referenceItems ?? []).map((item, index) => (
            <li key={`${item.sourceCode}-${item.heading}-${index}`} className="py-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-slate-900 text-sm">{item.heading}</h3>
                <strong className="text-sm font-bold text-slate-900 font-mono">{item.value}</strong>
              </div>
              <p className="mt-1 text-sm text-slate-700 leading-relaxed">{item.explanation}</p>
              <p className="mt-2 text-xs text-slate-500">
                {item.classification === 'REQUIRES_INDIVIDUAL_REVIEW'
                  ? 'Individual review'
                  : item.classification === 'CALCULATED_REFERENCE'
                    ? 'Calculated population reference'
                    : 'General reference'}{' '}
                · Source:{' '}
                {item.sourceUrl?.startsWith('https://') ? (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline text-slate-700 hover:text-slate-950 font-medium"
                  >
                    {item.sourceTitle}
                  </a>
                ) : (
                  item.sourceTitle
                )}
              </p>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-7 border-b border-slate-200 pb-6 text-sm">
        <h2 className="text-base font-bold text-slate-900 tracking-tight">Meal planning status</h2>
        <p className="mt-2 text-slate-700 leading-relaxed">
          Acknowledging this document records that the user reviewed it. Meal eligibility and Registered
          Nutritionist-Dietitian review are separate checks. Acknowledgment does not itself clear a meal or a medical
          condition.
        </p>
      </section>
      <section className="mt-6 pt-2 text-xs text-slate-500 leading-relaxed">
        <p className="font-semibold text-slate-700 uppercase tracking-wider text-[11px] mb-1">
          Clinical &amp; Educational Advisory
        </p>
        <p>
          This report is prepared for educational guidance and baseline meal planning referencing DOST-FNRI Philippine
          Dietary Reference Intakes (PDRI) standards. It does not replace individualized medical advice, clinical
          diagnosis, or medical nutrition therapy from a licensed physician or Registered Nutritionist-Dietitian (RND).
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 text-[11px] text-slate-400 font-mono">
          <span>
            RECORD REF: KN-PR-{report.version}-{report.id ? report.id.slice(-6).toUpperCase() : 'AUTH'}
          </span>
          <span>DOST-FNRI PDRI 2015 (REV. 2018)</span>
          <span>PAGE 1 OF 1</span>
        </div>
      </section>
    </article>
  );
}

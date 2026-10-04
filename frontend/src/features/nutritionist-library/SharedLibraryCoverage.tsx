import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { LibraryCoverage } from './useNutritionistLibrary';

const coverageSlots = ['BREAKFAST', 'LUNCH', 'DINNER'] as const;

function CoverageSlotCounts({
  label,
  counts,
}: {
  label: string;
  counts: Record<(typeof coverageSlots)[number], number>;
}) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold text-brand-muted">{label}</p>
      <dl className="grid grid-cols-3 gap-1 text-center">
        {coverageSlots.map((slot) => (
          <div key={slot} className="rounded-lg border border-brand-border/50 bg-brand-bg/50 px-1 py-2">
            <dt className="text-[8px] font-bold uppercase text-brand-muted">{slot.slice(0, 1)}</dt>
            <dd className="mt-0.5 font-mono text-xs font-black text-brand-text">{counts[slot]}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function SharedLibraryCoverage({ coverage }: { coverage: LibraryCoverage }) {
  return (
    <section aria-labelledby="coverage-heading" className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-brand-green">
            Coverage monitor
          </p>
          <h2 id="coverage-heading" className="font-display text-lg font-black text-brand-text">
            Recipe availability and review readiness
          </h2>
        </div>
        <p className="text-xs text-brand-muted">
          {coverage.sourceRecipesWithCoreNutrition} Panlasang sources with core numbers · {coverage.certifiedMeals}{' '}
          certified library servings
        </p>
      </div>
      <p className="text-xs leading-relaxed text-brand-muted">
        Source recipes can support general-wellness planning; their numbers may include estimates and do not grant
        condition or allergy clearance. The counts below use certified library servings only. Automatic reuse needs a
        current matching clearance or approval. Case-review candidates still need an individual nutritionist decision.
        The variety target is {coverage.requiredPerSlot} distinct choices per main-meal slot.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {coverage.profiles.map((profile) => (
          <Card key={profile.key} className="border-brand-border/60 bg-brand-surface/65 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-extrabold text-brand-text">{profile.label}</p>
                <p className="mt-1 text-[10px] text-brand-muted">Auto reuse: {profile.minimumPerSlot} lowest slot</p>
              </div>
              <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                {profile.weekReady ? 'Auto variety met' : 'Auto reuse below target'}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              <CoverageSlotCounts label="Automatically reusable · B / L / D" counts={profile.counts} />
              <CoverageSlotCounts label="Can enter case review · B / L / D" counts={profile.caseReviewCounts} />
            </div>
            <details className="mt-3 text-xs">
              <summary>Serving fit by daily target</summary>
              <p className="my-2 text-brand-muted">
                Each line applies the meal-slot calorie range to those servings. Case-review counts are potential review
                work, not approved meals.
              </p>
              {profile.servingCoverage?.map((row) => (
                <div key={row.dailyCalorieTarget} className="mt-2 border-t border-brand-border/40 pt-2">
                  <p>
                    {row.dailyCalorieTarget} kcal/day · {row.weekReady ? 'Auto variety met' : 'Auto reuse below target'}
                  </p>
                  <p className="text-brand-muted">
                    Auto: B {row.counts.BREAKFAST} · L {row.counts.LUNCH} · D {row.counts.DINNER}
                  </p>
                  <p className="text-brand-muted">
                    Case review: B {row.caseReviewCounts.BREAKFAST} · L {row.caseReviewCounts.LUNCH} · D{' '}
                    {row.caseReviewCounts.DINNER}
                  </p>
                </div>
              ))}
            </details>
          </Card>
        ))}
      </div>
      <Card className="overflow-hidden border-brand-border/60 bg-brand-surface/65 p-0">
        <div className="border-b border-brand-border/60 px-4 py-3">
          <h3 className="text-sm font-extrabold text-brand-text">Combined restriction matrix</h3>
          <p className="mt-1 text-[11px] text-brand-muted">
            Each cell shows the lowest breakfast, lunch, or dinner count for automatic reuse and for separate
            case-review candidates.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead>
              <tr className="bg-brand-bg/45">
                <th
                  scope="col"
                  className="sticky left-0 z-10 border-r border-brand-border/50 bg-brand-bg px-4 py-3 font-mono text-[9px] uppercase tracking-wider text-brand-muted"
                >
                  Condition
                </th>
                {coverage.combinationColumns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="px-3 py-3 text-center text-[10px] font-extrabold text-brand-muted"
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coverage.combinationMatrix.map((row) => (
                <tr key={row.key} className="border-t border-brand-border/50">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-r border-brand-border/50 bg-brand-surface px-4 py-3 text-xs font-extrabold text-brand-text"
                  >
                    {row.label}
                  </th>
                  {row.cells.map((cell) => {
                    const detail = `Automatic reuse: breakfast ${cell.counts.BREAKFAST}, lunch ${cell.counts.LUNCH}, dinner ${cell.counts.DINNER}. Case review: breakfast ${cell.caseReviewCounts.BREAKFAST}, lunch ${cell.caseReviewCounts.LUNCH}, dinner ${cell.caseReviewCounts.DINNER}`;
                    return (
                      <td key={cell.key} className="px-2 py-2 text-center">
                        <span
                          tabIndex={0}
                          title={detail}
                          aria-label={`${row.label} and ${cell.label}: ${cell.minimumPerSlot} lowest-slot automatic choices, ${cell.caseReviewMinimumPerSlot} lowest-slot case-review candidates. ${detail}.`}
                          className={`inline-flex min-w-[130px] items-center justify-center gap-1 rounded-xl border px-2 py-2 font-mono text-[10px] font-black outline-none transition focus:ring-2 focus:ring-brand-cyan/40 ${cell.weekReady ? 'border-brand-green/35 bg-brand-green/10 text-brand-green' : 'border-status-warning-text/35 bg-status-warning-bg/15 text-status-warning-text'}`}
                        >
                          <span>
                            Auto {cell.minimumPerSlot}/{coverage.requiredPerSlot}
                          </span>
                          <span className="ml-1 border-l border-current/30 pl-1">
                            Review {cell.caseReviewMinimumPerSlot}
                          </span>
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="grid gap-3 lg:grid-cols-3" aria-label="Structured combined profile coverage">
        {coverage.structuredProfiles.map((profile) => (
          <Card key={profile.key} className="border-brand-border/60 bg-brand-surface/65 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-brand-cyan">
                  Structured profile
                </p>
                <p className="mt-1 text-sm font-extrabold text-brand-text">{profile.label}</p>
              </div>
              <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                {profile.weekReady ? 'Auto variety met' : 'Auto reuse below target'}
              </Badge>
            </div>
            <div className="mt-4 space-y-3">
              <CoverageSlotCounts label="Automatically reusable · B / L / D" counts={profile.counts} />
              <CoverageSlotCounts label="Can enter case review · B / L / D" counts={profile.caseReviewCounts} />
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}

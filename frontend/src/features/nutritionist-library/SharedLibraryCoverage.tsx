import Card from '@/components/ui/Card';
import WorkspaceTable from '@/components/shared/WorkspaceTable';
import Badge from '@/components/ui/Badge';
import type { LibraryCoverage } from './useNutritionistLibrary';

type CoverageSlot = 'BREAKFAST' | 'LUNCH' | 'DINNER';

function slotCounts(counts: Record<CoverageSlot, number>) {
  return 'B ' + counts.BREAKFAST + ' · L ' + counts.LUNCH + ' · D ' + counts.DINNER;
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
        current matching clearance or approval. Case-review candidates still need an individual RND decision. The
        variety target is {coverage.requiredPerSlot} distinct choices per main-meal slot.
      </p>
      <WorkspaceTable
        label="Profile recipe coverage"
        rows={coverage.profiles}
        rowKey={(profile) => profile.key}
        columns={[
          {
            key: 'profile',
            header: 'Profile',
            headerClassName: 'min-w-[180px]',
            cell: (profile) => (
              <>
                <strong>{profile.label}</strong>
                <p className="mt-1 text-brand-muted">Auto reuse: {profile.minimumPerSlot} lowest slot</p>
              </>
            ),
          },
          {
            key: 'auto',
            header: 'Automatically reusable · B / L / D',
            headerClassName: 'min-w-[180px]',
            cell: (profile) => slotCounts(profile.counts),
          },
          {
            key: 'review',
            header: 'Can enter case review · B / L / D',
            headerClassName: 'min-w-[180px]',
            cell: (profile) => slotCounts(profile.caseReviewCounts),
          },
          {
            key: 'status',
            header: 'Variety',
            cell: (profile) => (
              <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                {profile.weekReady ? 'Auto variety met' : 'Auto reuse below target'}
              </Badge>
            ),
          },
          {
            key: 'serving',
            header: 'Serving fit',
            headerClassName: 'min-w-[220px]',
            cell: (profile) => (
              <details>
                <summary>Serving fit by daily target</summary>
                <p className="my-2 text-brand-muted">
                  Each line applies the meal-slot calorie range to those servings. Case-review counts are potential
                  review work, not approved meals.
                </p>
                <WorkspaceTable
                  label={profile.label + ' serving coverage'}
                  rows={profile.servingCoverage ?? []}
                  rowKey={(row) => String(row.dailyCalorieTarget)}
                  columns={[
                    {
                      key: 'target',
                      header: 'Daily target',
                      cell: (row) => (
                        <>
                          {row.dailyCalorieTarget} kcal/day ·{' '}
                          {row.weekReady ? 'Auto variety met' : 'Auto reuse below target'}
                        </>
                      ),
                    },
                    { key: 'auto', header: 'Automatic', cell: (row) => slotCounts(row.counts) },
                    { key: 'review', header: 'Case review', cell: (row) => slotCounts(row.caseReviewCounts) },
                  ]}
                />
              </details>
            ),
          },
        ]}
      />
      <Card className="overflow-hidden border-brand-border/60 bg-brand-surface/65 p-0">
        <div className="border-b border-brand-border/60 px-4 py-3">
          <h3 className="text-sm font-extrabold text-brand-text">Combined restriction matrix</h3>
          <p className="mt-1 text-[11px] text-brand-muted">
            Each cell shows the lowest breakfast, lunch, or dinner count for automatic reuse and for separate
            case-review candidates.
          </p>
        </div>
        <div className="overflow-x-auto">
          <WorkspaceTable
            label="Combined restriction matrix"
            rows={coverage.combinationMatrix}
            rowKey={(row) => row.key}
            columns={[
              {
                key: 'condition',
                header: 'Condition',
                headerClassName: 'min-w-[150px]',
                cell: (row) => <strong>{row.label}</strong>,
              },
              ...coverage.combinationColumns.map((column, index) => ({
                key: column.key,
                header: column.label,
                headerClassName: 'min-w-[150px] text-center',
                cellClassName: 'text-center',
                cell: (row: LibraryCoverage['combinationMatrix'][number]) => {
                  const cell = row.cells[index];
                  if (!cell) return 'Not recorded';
                  const detail =
                    'Automatic reuse: breakfast ' +
                    cell.counts.BREAKFAST +
                    ', lunch ' +
                    cell.counts.LUNCH +
                    ', dinner ' +
                    cell.counts.DINNER +
                    '. Case review: breakfast ' +
                    cell.caseReviewCounts.BREAKFAST +
                    ', lunch ' +
                    cell.caseReviewCounts.LUNCH +
                    ', dinner ' +
                    cell.caseReviewCounts.DINNER;
                  return (
                    <span
                      tabIndex={0}
                      title={detail}
                      aria-label={
                        row.label +
                        ' and ' +
                        cell.label +
                        ': ' +
                        cell.minimumPerSlot +
                        ' lowest-slot automatic choices, ' +
                        cell.caseReviewMinimumPerSlot +
                        ' lowest-slot case-review candidates. ' +
                        detail +
                        '.'
                      }
                      className={
                        'inline-flex min-w-[130px] items-center justify-center gap-1 rounded-xl border px-2 py-2 font-mono text-[10px] font-black outline-none transition focus:ring-2 focus:ring-brand-cyan/40 ' +
                        (cell.weekReady
                          ? 'border-brand-green/35 bg-brand-green/10 text-brand-green'
                          : 'border-status-warning-text/35 bg-status-warning-bg/15 text-status-warning-text')
                      }
                    >
                      <span>
                        Auto {cell.minimumPerSlot}/{coverage.requiredPerSlot}
                      </span>
                      <span className="ml-1 border-l border-current/30 pl-1">
                        Review {cell.caseReviewMinimumPerSlot}
                      </span>
                    </span>
                  );
                },
              })),
            ]}
          />
        </div>
      </Card>
      <WorkspaceTable
        label="Structured combined profile coverage"
        rows={coverage.structuredProfiles}
        rowKey={(profile) => profile.key}
        columns={[
          { key: 'profile', header: 'Structured profile', cell: (profile) => <strong>{profile.label}</strong> },
          { key: 'auto', header: 'Automatically reusable · B / L / D', cell: (profile) => slotCounts(profile.counts) },
          {
            key: 'review',
            header: 'Can enter case review · B / L / D',
            cell: (profile) => slotCounts(profile.caseReviewCounts),
          },
          {
            key: 'status',
            header: 'Variety',
            cell: (profile) => (
              <Badge variant={profile.weekReady ? 'verified' : 'pending'} showIcon={false} className="text-[9px]">
                {profile.weekReady ? 'Auto variety met' : 'Auto reuse below target'}
              </Badge>
            ),
          },
        ]}
      />
    </section>
  );
}

'use client';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useAdminAnalytics } from './useAdminAnalytics';

const humanize = (value: string) => value.toLowerCase().replaceAll('_', ' ');
const format = (value: number) => value.toLocaleString();

function Metrics({ items }: { items: Array<{ label: string; count: number; note: string; href?: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="p-5">
          <p className="text-sm font-bold text-brand-muted">{item.label}</p>
          <p className="mt-2 font-display text-3xl font-black text-brand-text">{format(item.count)}</p>
          <p className="mt-2 text-xs text-brand-muted">{item.note}</p>
          {item.href && (
            <Link
              href={item.href}
              className="mt-3 inline-flex min-h-11 items-center text-xs font-bold text-brand-green"
            >
              View records →
            </Link>
          )}
        </Card>
      ))}
    </div>
  );
}

export default function AdminStatistics({ active = true }: { active?: boolean }) {
  const { data, error, isLoading, refetch } = useAdminAnalytics(active);
  if (!data)
    return (
      <Card className="space-y-3 p-6">
        <p role={error ? 'alert' : 'status'}>
          {error ?? (isLoading ? 'Loading platform statistics…' : 'Statistics are unavailable.')}
        </p>
        {error && (
          <Button variant="secondary" onClick={() => void refetch()}>
            Retry
          </Button>
        )}
      </Card>
    );
  const savedCandidates = data.planSelectionsByProvenance30d.reduce((sum, row) => sum + row.count, 0);
  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-brand-muted">
          Snapshot: {new Date(data.generatedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })} (Manila)
        </p>
        <Button variant="secondary" onClick={() => void refetch()}>
          Refresh statistics
        </Button>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-status-warning-text/30 p-3 text-sm text-status-warning-text"
        >
          {error} Showing the last successful snapshot above.
        </p>
      )}
      <section aria-labelledby="platform-totals">
        <h2 id="platform-totals" className="portal-section-label mb-4">
          Platform totals
        </h2>
        <Metrics
          items={[
            {
              label: 'Member accounts',
              count: data.totalUsers,
              note: 'Accounts with the member role, including suspended accounts.',
              href: '/admin/users',
            },
            {
              label: 'Eligible nutritionists',
              count: data.verifiedNutritionists,
              note: `Of ${format(data.totalNutritionists)} nutritionist accounts with profiles. Verified, unsuspended, with a current PRC license.`,
              href: '/admin/users?tab=nutritionists',
            },
            {
              label: 'Current plan cycles',
              count: data.activeMealPlans,
              note: 'Latest current cycle per active member, based on the Manila date.',
            },
            {
              label: 'Approved upcoming slots',
              count: data.approvedUpcomingMealSlots,
              note: 'Recorded approved slots from today onward; excludes superseded plans and safety holds.',
            },
            {
              label: 'Library servings',
              count: data.libraryCount,
              note: 'Saved serving records, including variants and archived records.',
              href: '/admin/meals?tab=library',
            },
            {
              label: 'Food logs recorded',
              count: data.totalMealLogs,
              note: 'Logs marked done. Skipped, pending, and voided logs are excluded.',
            },
            {
              label: 'FNRI food records',
              count: data.totalFoodItems,
              note: 'Food composition records sourced from FNRI.',
              href: '/admin/data',
            },
            {
              label: 'USDA food records',
              count: data.usdaFoodItems,
              note: `${format(data.totalAliases)} food aliases across the catalogue.`,
              href: '/admin/data',
            },
          ]}
        />
      </section>
      <section aria-labelledby="review-signals">
        <h2 id="review-signals" className="portal-section-label mb-4">
          Review & preparation signals
        </h2>
        <Metrics
          items={[
            {
              label: 'Upcoming slots awaiting review',
              count: data.pendingReviews,
              note: `${format(data.activeReviewClaims)} slots have a current eligible reviewer claim. Counts slots, not grouped queue cases.`,
            },
            {
              label: 'Waiting over 2 hours',
              count: data.overdueReviews,
              note: 'Pending upcoming meal slots created more than two hours ago.',
            },
            {
              label: 'Pending today & next 48 hours',
              count: data.pendingPlansStartingSoon,
              note: 'Includes slots dated today, even when their saved date is midnight.',
            },
            {
              label: 'Expired verified licenses',
              count: data.expiredVerifiedNutritionists,
              note: 'Nutritionist accounts with verified profiles and licenses that expired before today in Manila.',
              href: '/admin/users?tab=nutritionists',
            },
            {
              label: 'Failed preparation jobs • 24h',
              count: data.failedGenerationJobs24h,
              note: 'Jobs currently failed and updated in the last 24 hours; not a history of all failure attempts.',
            },
            {
              label: 'Jobs without an update >20 min',
              count: data.stuckGenerationJobs,
              note: 'Generating or processing AI. Jobs waiting for AI capacity are excluded.',
            },
            {
              label: 'Check-ins recommending review • 30d',
              count: data.adaptationReviews30d,
              note: 'Saved check-in records, rather than a count of unique members.',
            },
            {
              label: 'Available source recipes',
              count: data.rawRecipeCandidates,
              note: 'Available raw candidates. Availability alone does not mean reviewed or safe for planning.',
            },
          ]}
        />
      </section>
      <section aria-labelledby="library-evidence">
        <h2 id="library-evidence" className="portal-section-label mb-4">
          Recorded library evidence
        </h2>
        <Metrics
          items={[
            {
              label: 'Complete evidence records',
              count: data.completeLibraryEvidence,
              note: 'Recorded complete status across all library servings.',
            },
            {
              label: 'Incomplete evidence records',
              count: data.incompleteLibraryEvidence,
              note: 'Recorded incomplete status across all library servings.',
            },
            {
              label: 'Stale evidence records',
              count: data.staleLibraryEvidence,
              note: 'Recorded stale status across all library servings.',
              href: '/admin/meals?tab=library',
            },
            {
              label: 'Active, unexpired clearances',
              count: data.activeConditionClearances,
              note: 'Clearances marked active with no expiry or a future expiry.',
            },
          ]}
        />
        <p className="mt-3 text-xs text-brand-muted">
          These are saved evidence states. Meal approval, reviewer eligibility, policy versions, and member restrictions
          are checked separately before a meal can be used.
        </p>
        {data.activeClearancesByCondition.length > 0 && (
          <Card className="mt-4 p-5">
            <h3 className="mb-3 font-bold">Clearance coverage</h3>
            <ul className="space-y-2 text-sm">
              {data.activeClearancesByCondition.map((row) => (
                <li
                  key={`${row.condition}:${row.assuranceTier}:${row.provenance}`}
                  className="flex flex-wrap justify-between gap-2"
                >
                  <span>
                    {humanize(row.condition)} · {humanize(row.assuranceTier)} · {humanize(row.provenance)}
                  </span>
                  <strong>{format(row.count)}</strong>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
      <section aria-labelledby="ai-history">
        <h2 id="ai-history" className="portal-section-label mb-4">
          Recorded AI activity
        </h2>
        <Metrics
          items={[
            {
              label: 'Successful AI operations • 24h',
              count: data.aiSuccess24h,
              note: 'Recorded completed operations.',
            },
            { label: 'Failed AI operations • 24h', count: data.aiFailures24h, note: 'Recorded failed operations.' },
            {
              label: 'Planning AI operations • 30d',
              count: data.planningAiOperations30d,
              note: 'Corpus lookup and meal generation operations.',
            },
            {
              label: 'Saved meal candidates • 30d',
              count: savedCandidates,
              note: 'Saved rows created in the last 30 days, including replaced or cancelled candidates.',
            },
          ]}
        />
        <p className="mt-3 text-xs text-brand-muted">
          An operation can try several models. These totals count recorded operations, not individual provider requests
          or retries. Missing telemetry is not included.
        </p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h3 className="mb-3 font-bold">Operations • last 30 days</h3>
            {data.aiUsageByOperation30d.length ? (
              <ul className="space-y-3 text-sm">
                {data.aiUsageByOperation30d.map((row) => (
                  <li key={`${row.operation}:${row.purpose}:${row.status}`} className="flex justify-between gap-3">
                    <span className="break-words">
                      {humanize(row.operation)} · {humanize(row.purpose)} · {humanize(row.status)}
                    </span>
                    <strong>{format(row.count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-muted">No recorded AI operations in this period.</p>
            )}
          </Card>
          <Card className="p-5">
            <h3 className="mb-3 font-bold">Saved candidate sources • last 30 days</h3>
            {data.planSelectionsByProvenance30d.length ? (
              <ul className="space-y-3 text-sm">
                {data.planSelectionsByProvenance30d.map((row) => (
                  <li key={row.provenance} className="flex justify-between gap-3">
                    <span>{humanize(row.provenance)}</span>
                    <strong>{format(row.count)}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-brand-muted">No saved candidates in this period.</p>
            )}
            <p className="mt-4 text-xs text-brand-muted">
              Sources reflect the current saved candidate records, not an immutable history of original planner choices.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}

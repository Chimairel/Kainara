'use client';

import {
  Users,
  Stethoscope,
  CalendarDays,
  CheckCircle2,
  UtensilsCrossed,
  ClipboardList,
  BookOpen,
  FileText,
  Database,
} from 'lucide-react';
import Link from 'next/link';
import Card from '@/components/ui/Card';

import { cn } from '@/lib/utils';

import { format, HeroMetricCard } from './AdminStatistics.shared';
import type { useAdminStatisticsModel } from './useAdminStatisticsModel';
type Model = Extract<ReturnType<typeof useAdminStatisticsModel>, { kind: 'ready' }>;
type SectionProps = { model: Pick<Model, 'activeTab' | 'data'> };
export default function PlatformTotalsSection({ model }: SectionProps) {
  const { activeTab, data } = model;

  return (
    <>
      <div
        id="analytics-tab-totals"
        role="tabpanel"
        aria-labelledby="analytics-tab-totals-btn"
        hidden={activeTab !== 'totals'}
        className={cn('space-y-6', activeTab !== 'totals' && 'hidden')}
      >
        <section aria-labelledby="platform-totals" className="space-y-4">
          <div>
            <h2 id="platform-totals" className="portal-section-label">
              Platform totals
            </h2>
            <p className="text-xs text-brand-muted">
              Core population scale, clinical capacity, and food database records.
            </p>
          </div>

          {/* Tier A: Primary Pillars */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <HeroMetricCard
              label="Member accounts"
              count={data.totalUsers}
              note="Accounts with the member role, including suspended accounts."
              href="/admin/users"
              icon={Users}
              badgeTone="emerald"
            />
            <HeroMetricCard
              label="Eligible RNDs"
              count={data.verifiedNutritionists}
              note={`Of ${format(data.totalNutritionists)} nutritionist accounts with profiles. Verified, unsuspended, with a current PRC license.`}
              href="/admin/users?tab=nutritionists"
              icon={Stethoscope}
              badgeTone="teal"
            />
            <HeroMetricCard
              label="Current plan cycles"
              count={data.activeMealPlans}
              note="Latest current cycle per active member, based on the Manila date."
              icon={CalendarDays}
              badgeTone="amber"
            />
            <HeroMetricCard
              label="Approved upcoming slots"
              count={data.approvedUpcomingMealSlots}
              note="Recorded approved slots from today onward; excludes superseded plans and safety holds."
              icon={CheckCircle2}
              badgeTone="emerald"
            />
          </div>

          {/* Tier B: Food Data & Knowledge Estate */}
          <Card className="p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-border/50 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-green/10 text-brand-green">
                  <Database className="h-4 w-4" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-sm font-extrabold text-brand-text">
                    Food catalogue &amp; serving records
                  </h3>
                  <p className="text-xs text-brand-muted">
                    Government datasets, alias mappings, and approved serving variations
                  </p>
                </div>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 pt-4">
              <div className="flex flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-4 transition-colors hover:border-brand-border">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-surface text-brand-muted shadow-xs">
                      <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-brand-muted">Library servings</p>
                  <p className="mt-1 font-display text-2xl sm:text-3xl font-black text-brand-text">
                    {format(data.libraryCount)}
                  </p>
                  <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">
                    Saved serving records, including variants and archived records.
                  </p>
                </div>
                <div className="mt-3 border-t border-brand-border/40 pt-2">
                  <Link
                    href="/admin/meals?tab=library"
                    className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green hover:underline"
                  >
                    View records →
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-4 transition-colors hover:border-brand-border">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-surface text-brand-muted shadow-xs">
                      <ClipboardList className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-brand-muted">Food logs recorded</p>
                  <p className="mt-1 font-display text-2xl sm:text-3xl font-black text-brand-text">
                    {format(data.totalMealLogs)}
                  </p>
                  <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">
                    Logs marked done. Skipped, pending, and voided logs are excluded.
                  </p>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-4 transition-colors hover:border-brand-border">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-surface text-brand-muted shadow-xs">
                      <BookOpen className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-brand-muted">FNRI food records</p>
                  <p className="mt-1 font-display text-2xl sm:text-3xl font-black text-brand-text">
                    {format(data.totalFoodItems)}
                  </p>
                  <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">
                    Food composition records sourced from FNRI.
                  </p>
                </div>
                <div className="mt-3 border-t border-brand-border/40 pt-2">
                  <Link
                    href="/admin/data"
                    className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green hover:underline"
                  >
                    View records →
                  </Link>
                </div>
              </div>

              <div className="flex flex-col justify-between rounded-2xl border border-brand-border/60 bg-brand-bgAlt/30 p-4 transition-colors hover:border-brand-border">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-surface text-brand-muted shadow-xs">
                      <FileText className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-bold text-brand-muted">USDA food records</p>
                  <p className="mt-1 font-display text-2xl sm:text-3xl font-black text-brand-text">
                    {format(data.usdaFoodItems)}
                  </p>
                  <p className="mt-1.5 text-xs text-brand-muted leading-relaxed">
                    {format(data.totalAliases)} food aliases across the catalogue.
                  </p>
                </div>
                <div className="mt-3 border-t border-brand-border/40 pt-2">
                  <Link
                    href="/admin/data"
                    className="inline-flex min-h-11 items-center text-xs font-bold text-brand-green hover:underline"
                  >
                    View records →
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </>
  );
}

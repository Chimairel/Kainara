'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import QuarantinedMeals from './QuarantinedMeals';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import { Soup } from '@/components/ui/icons';

import LibraryRecipeDetail from './sections/LibraryRecipeDetail';
import LibraryFilterSection from './sections/LibraryFilterSection';
import LibraryResultsSection from './sections/LibraryResultsSection';
import { useSharedMealLibraryModel } from './sections/useSharedMealLibraryModel';
export default function SharedMealLibraryWorkspace({
  role = 'nutritionist',
  active = true,
  embedded = false,
}: {
  role?: 'admin' | 'nutritionist';
  active?: boolean;
  embedded?: boolean;
}) {
  const model = useSharedMealLibraryModel({ role, active, embedded });
  const { isAdmin, totalCount, setSection, section, fetchError, detailError } = model;
  if (model.viewedMeal) return <LibraryRecipeDetail model={model} />;
  return (
    <div className={`${embedded ? '' : 'portal-page '}space-y-6`}>
      {/* Header */}
      <PortalPageHeader
        headingLevel={embedded ? 'h2' : 'h1'}
        icon={Soup}
        eyebrow="Meal intelligence"
        title="Meal library"
        description={
          isAdmin
            ? 'Browse verified base meals and their recorded approvals. Pending meals are reviewed before entering the library.'
            : 'Browse verified base meals and their separate health-context approvals. Pending and held meals remain in their review queues.'
        }
        meta={section === 'verified' ?
          <span className="rounded-full border border-brand-border/70 bg-brand-surface/60 px-3 py-2 font-mono text-[9px] uppercase tracking-wider text-brand-muted dark:border-[#173e33] dark:bg-[#0e271f]">
            {totalCount} records
          </span> : undefined
        }
      />

      <WorkspaceTabs value={section} onChange={setSection} label="Library sections" level="secondary" animateIndicator={false}
        items={[{ value: 'verified', label: 'Verified' }, { value: 'quarantined', label: 'Quarantined' }]} />
      {(fetchError || detailError) && (
        <FeedbackNotice>
          <span>{fetchError || detailError}</span>
        </FeedbackNotice>
      )}

      <QuarantinedMeals isAdmin={isAdmin} active={active && section === 'quarantined'} openMeal={model.openMeal} />
      <div hidden={section !== 'verified'} className="space-y-5">
        {/* Top Filter Panel */}
        <LibraryFilterSection model={model} />

        {/* Main Meal Grid / Table */}
        <LibraryResultsSection model={model} />


      </div>
    </div>
  );
}

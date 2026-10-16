'use client';
import FeedbackNotice from '@/components/shared/FeedbackNotice';

import PreviousPlanPurchases from './PreviousPlanPurchases';
import WorkspaceTabs from '@/components/ui/WorkspaceTabs';
import GrocerySkeleton from '@/features/grocery/GrocerySkeleton';
import PortalPageHeader from '@/components/shared/PortalPageHeader';
import UnauthorizedState from '@/components/shared/UnauthorizedState';

import GroceryFiltersSection from './GroceryFiltersSection';
import GroceryItemsSection from './GroceryItemsSection';
import GroceryProgressSection from './GroceryProgressSection';
import { useGroceryWorkspace } from './useGroceryWorkspace';

export default function GroceryWorkspace() {
  const model = useGroceryWorkspace();
  const {
    isLoading,
    visibleWorkspace,
    scope,
    setScope,
    setQuery,
    setFilter,
    setSelectedCategory,
    error,
    isReportPending,
    projection,
    groceryList,
    pendingMealCount,
    setSelectedDay,
  } = model;
  return (
    <div className="portal-page max-w-5xl text-brand-text">
      {/* HEADER SECTION */}
      <PortalPageHeader
        title="Groceries"
        description="A simple checklist for the ingredients in your meal plan."
        className="mb-6"
      />

      {!isLoading && visibleWorkspace ? (
        <WorkspaceTabs
          value={scope}
          label="Grocery week"
          className="mb-5"
          onChange={(value) => {
            setScope(value);
            setQuery('');
            setFilter('all');
            setSelectedCategory('ALL');
            setSelectedDay('ALL');
          }}
          items={[
            { value: 'CURRENT', label: 'Current week' },
            { value: 'UPCOMING', label: 'Next week' },
          ]}
        />
      ) : null}

      {error && !error.toLowerCase().includes('nutrition report') ? (
        <FeedbackNotice className="mb-6">
          <span>{error}</span>
        </FeedbackNotice>
      ) : null}

      {/* GROCERY CONTENT */}
      {isLoading ? (
        <GrocerySkeleton />
      ) : isReportPending ? (
        <UnauthorizedState
          eyebrow="Action Required"
          title="Nutrition Report Pending"
          description="Please review and acknowledge your personalized nutrition report before grocery checklists can be generated."
          action={{
            label: 'View Nutrition Report',
            href: '/profile/nutrition-report',
          }}
        />
      ) : !projection ? (
        <UnauthorizedState
          imageSrc="/logo/verifying.svg"
          imageAlt="Plan preparation"
          eyebrow={scope === 'UPCOMING' ? 'Next week' : 'Current week'}
          title={scope === 'UPCOMING' ? 'No grocery list for next week yet' : 'No grocery list for this week yet'}
          description={
            scope === 'UPCOMING'
              ? 'Ingredients will appear here when meals for next week are available.'
              : 'Your current grocery list will appear when an active meal-plan cycle is available.'
          }
          action={{ label: 'View Meal Plan', href: '/meals' }}
        />
      ) : !groceryList ? (
        <UnauthorizedState
          imageSrc="/logo/verifying.svg"
          imageAlt="Verifying Meals"
          eyebrow="Plan preparation"
          title={scope === 'UPCOMING' ? 'Next-week List Preparing' : 'Grocery Checklist Preparing'}
          description={
            projection.cycle.status === 'REVALIDATION_REQUIRED'
              ? projection.actionability.message
              : pendingMealCount > 0
                ? `${pendingMealCount} meal slot${pendingMealCount === 1 ? '' : 's'} are not yet ready. Their ingredients are not shown in this checklist.`
                : 'Your checklist will appear automatically when cleared meal ingredients are available.'
          }
          action={{
            label: 'View Meal Plan',
            href: '/meals',
          }}
        />
      ) : (
        <div className="flex flex-col gap-5 text-left">
          {/* REIMAGINED SHOPPING PROGRESS HERO (WITH RETRO WAVE STRIPES & MODERN FEEL) */}
          {!model.dayView ? <GroceryProgressSection model={model} /> : null}

          {/* SEARCH & FILTERS TOOLBAR */}
          <GroceryFiltersSection model={model} />

          {/* SPREADSHEET DATAGRID TABLE */}
          <GroceryItemsSection model={model} />
        </div>
      )}
      {!isLoading && !isReportPending && visibleWorkspace && projection?.previousPurchases && (
        <PreviousPlanPurchases items={projection.previousPurchases} />
      )}
    </div>
  );
}

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import Button from '@/components/ui/Button';
import { RefreshCw } from 'lucide-react';

type Props = {
  activeTab: 'plan' | 'history' | 'library';
  upcomingOnly: boolean;
  isStarterPlan: boolean;
  upcomingStart: string | null;
  nextCycleDay: string | null;
  pendingReview: unknown;
  handleRegeneratePlan: () => void;
};

export default function MealsWorkspaceHeader({
  activeTab,
  upcomingOnly,
  isStarterPlan,
  upcomingStart,
  nextCycleDay,
  pendingReview,
  handleRegeneratePlan,
}: Props) {
  return (
    <PortalPageHeader
      title={
        activeTab === 'plan'
          ? upcomingOnly
            ? 'Upcoming meal plan preview'
            : isStarterPlan
              ? 'Starter meal plan'
              : 'Weekly meal plan'
          : activeTab === 'history'
            ? 'Meal history'
            : 'Meal library'
      }
      description={
        activeTab === 'plan'
          ? upcomingOnly
            ? `Automatically prepared ahead of ${upcomingStart ?? 'your next week'}. These meals are not your active plan.`
            : isStarterPlan && nextCycleDay
              ? `Starter kickoff plan. Your full weekly cycle starts ${nextCycleDay}.`
              : 'Your complete scheduled breakdown, macro targets, and meal review states.'
          : activeTab === 'history'
            ? 'Your logged intake history, completion states, and swapped items.'
            : 'Browse compatible, nutritionist-verified recipes for your profile.'
      }
      className="mb-1"
      actions={
        activeTab === 'plan' && !pendingReview ? (
          <details className="relative">
            <summary className="cursor-pointer rounded-xl border border-brand-border bg-brand-surface px-4 py-2 text-sm font-semibold">
              Plan options
            </summary>
            <div className="mt-2 max-w-xs rounded-xl border border-brand-border bg-brand-surface p-3">
              <p className="mb-3 text-xs text-brand-muted">
                Whole-plan replacement is available before shopping or logging. After that, choose individual meal
                swaps.
              </p>
              <Button
                variant="secondary"
                onClick={() => handleRegeneratePlan()}
                className="flex items-center gap-1.5 text-xs font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Replace entire plan</span>
              </Button>
            </div>
          </details>
        ) : undefined
      }
    />
  );
}

import PortalPageHeader from '@/components/shared/PortalPageHeader';
import type { ReactNode } from 'react';

type Props = {
  activeTab: 'plan' | 'history' | 'library';
  upcomingOnly: boolean;
  isStarterPlan: boolean;
  upcomingStart: string | null;
  nextCycleDay: string | null;
  actions?: ReactNode;
};

export default function MealsWorkspaceHeader({
  activeTab,
  upcomingOnly,
  isStarterPlan,
  upcomingStart,
  nextCycleDay,
  actions,
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
      actions={actions}
    />
  );
}

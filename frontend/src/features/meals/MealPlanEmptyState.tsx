import StateNotice from '@/components/shared/StateNotice';

type Props = {
  error: string | null;
  generationStatus: string | null;
  isRegenerating: boolean;
  onRetryLoad: () => void;
  onRetryPreparation: () => void;
};

export default function MealPlanEmptyState({
  error,
  generationStatus,
  isRegenerating,
  onRetryLoad,
  onRetryPreparation,
}: Props) {
  if (error) {
    return (
      <StateNotice
        variant="no-meal-plan"
        title="Could not load your meal plan"
        description="The meal plan could not be retrieved. Retry loading your saved plan."
        action={{ label: 'Retry loading', onClick: onRetryLoad }}
      />
    );
  }
  const preparing = ['GENERATING', 'WAITING_FOR_AI', 'PROCESSING_AI'].includes(generationStatus ?? '');
  const failed = generationStatus === 'FAILED';
  return (
    <StateNotice
      variant="no-meal-plan"
      imageAlt="Meal plan status"
      title={
        failed
          ? 'Meal plan preparation failed'
          : preparing
            ? 'Preparing Your First Meal Plan'
            : 'No available meals in this plan'
      }
      description={
        failed
          ? 'Your nutrition report is acknowledged, but your first meal plan could not be prepared. Retry preparation to try again.'
          : preparing
            ? 'Your current meal plan is being prepared automatically. Candidates will appear here for nutritionist review.'
            : 'No available meals were returned for this plan. Check any review or unavailable-meal notices above, or retry loading the saved plan.'
      }
      action={
        failed
          ? {
              label: isRegenerating ? 'Retrying...' : 'Retry Preparation',
              onClick: onRetryPreparation,
              isLoading: isRegenerating,
            }
          : preparing
            ? null
            : { label: 'Retry loading', onClick: onRetryLoad }
      }
    />
  );
}

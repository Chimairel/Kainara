import StateNotice from '@/components/shared/StateNotice';

type Props = {
  error: string | null;
  generationStatus: string | null;
  isRegenerating: boolean;
  awaitingGenerationCount?: number;
  onRetryLoad: () => void;
  onRetryPreparation: () => void;
};

export default function MealPlanEmptyState({
  error,
  generationStatus,
  isRegenerating,
  awaitingGenerationCount = 0,
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
  const preparing =
    isRegenerating ||
    awaitingGenerationCount > 0 ||
    ['GENERATING', 'WAITING_FOR_AI', 'PROCESSING_AI'].includes(generationStatus ?? '');
  const failed = generationStatus === 'FAILED' && !isRegenerating;

  if (failed) {
    return (
      <StateNotice
        variant="preparing-failed"
        title="Meal plan preparation failed"
        description="Your nutrition report is acknowledged, but your first meal plan could not be prepared. Retry preparation to try again."
        action={{
          label: 'Retry Preparation',
          onClick: onRetryPreparation,
        }}
      />
    );
  }

  if (preparing) {
    return (
      <StateNotice
        variant="preparing"
        title="Preparing Your First Meal Plan"
        description="Your current meal plan is being prepared automatically. Candidates will appear here for RND review."
        action={null}
      />
    );
  }

  return (
    <StateNotice
      variant="no-meal-plan"
      title="No available meals in this plan"
      description="No available meals were returned for this plan. Check any review or unavailable-meal notices above, or retry loading the saved plan."
      action={{ label: 'Retry loading', onClick: onRetryLoad }}
    />
  );
}

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealPlanEmptyState from './MealPlanEmptyState';

describe('empty plan state', () => {
  it.each([null, 'COMPLETED'])('does not claim first-plan generation when the saved job is %s', (generationStatus) => {
    render(
      <MealPlanEmptyState
        error={null}
        generationStatus={generationStatus}
        isRegenerating={false}
        onRetryLoad={vi.fn()}
        onRetryPreparation={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: 'No available meals in this plan' })).toBeInTheDocument();
    expect(screen.queryByText('Preparing Your First Meal Plan')).not.toBeInTheDocument();
  });
  it.each(['GENERATING', 'WAITING_FOR_AI', 'PROCESSING_AI'])(
    'keeps the real %s preparation notice',
    (generationStatus) => {
      render(
        <MealPlanEmptyState
          error={null}
          generationStatus={generationStatus}
          isRegenerating={false}
          onRetryLoad={vi.fn()}
          onRetryPreparation={vi.fn()}
        />
      );
      expect(screen.getByRole('heading', { name: 'Preparing Your First Meal Plan' })).toBeInTheDocument();
    }
  );
  it('retries reading rather than generating when loading fails', () => {
    const read = vi.fn(),
      generate = vi.fn();
    render(
      <MealPlanEmptyState
        error="Request timed out"
        generationStatus="GENERATING"
        isRegenerating={false}
        onRetryLoad={read}
        onRetryPreparation={generate}
      />
    );
    expect(screen.queryByText('Preparing Your First Meal Plan')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
    expect(read).toHaveBeenCalledOnce();
    expect(generate).not.toHaveBeenCalled();
  });
  it('keeps the explicit preparation retry for a failed generation job', () => {
    const read = vi.fn(),
      generate = vi.fn();
    render(
      <MealPlanEmptyState
        error={null}
        generationStatus="FAILED"
        isRegenerating={false}
        onRetryLoad={read}
        onRetryPreparation={generate}
      />
    );
    expect(screen.getByAltText('Meal plan preparation failed')).toHaveAttribute('src', expect.stringContaining('preparing-failed.svg'));
    fireEvent.click(screen.getByRole('button', { name: 'Retry Preparation' }));
    expect(generate).toHaveBeenCalledOnce();
    expect(read).not.toHaveBeenCalled();
  });

  it('transitions immediately back to preparing state when isRegenerating is true', () => {
    render(
      <MealPlanEmptyState
        error={null}
        generationStatus="FAILED"
        isRegenerating={true}
        onRetryLoad={vi.fn()}
        onRetryPreparation={vi.fn()}
      />
    );
    expect(screen.getByRole('heading', { name: 'Preparing Your First Meal Plan' })).toBeInTheDocument();
    expect(screen.getByAltText('Preparing your meal plan')).toHaveAttribute('src', expect.stringContaining('preparing.svg'));
    expect(screen.queryByRole('button', { name: 'Retry Preparation' })).not.toBeInTheDocument();
  });

  it('uses sleeping graphic only for idle empty state', () => {
    render(
      <MealPlanEmptyState
        error={null}
        generationStatus={null}
        isRegenerating={false}
        onRetryLoad={vi.fn()}
        onRetryPreparation={vi.fn()}
      />
    );
    expect(screen.getByAltText('Meal plan status')).toHaveAttribute('src', expect.stringContaining('sleeping'));
  });
});

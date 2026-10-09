import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import MealCard from './MealCard';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imgProps = { ...props };
    delete imgProps.fill;
    delete imgProps.priority;
    return React.createElement('img', imgProps);
  },
}));

describe('MealCard', () => {
  const defaultProps = {
    id: 'meal-1',
    mealName: 'Sinigang na Hipon',
    mealType: 'LUNCH' as const,
    description: 'Sour tamarind soup with shrimp and kangkong.',
    calories: 350,
    proteinG: 28,
    carbsG: 14,
    fatG: 8,
    status: 'APPROVED' as const,
    aiConfidenceFlag: 'SAFE' as const,
    ingredients: [
      { id: 'ing-1', ingredientName: 'Shrimp' },
      { id: 'ing-2', ingredientName: 'Kangkong' },
    ],
  };

  it('labels an approved meal without an RND verifier as ready', () => {
    render(<MealCard {...defaultProps} />);

    expect(screen.getAllByText('Sinigang na Hipon').length).toBeGreaterThan(0);
    expect(screen.getByText(/350 kcal/i)).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('renders Awaiting Review badge when status is PENDING_REVIEW', () => {
    render(<MealCard {...defaultProps} status="PENDING_REVIEW" />);

    expect(screen.getByText('Awaiting Review')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('renders Eaten status badge when meal is marked as DONE', () => {
    render(<MealCard {...defaultProps} mealLogs={[{ id: 'log-1', status: 'DONE' }]} />);

    expect(screen.getByText('Eaten')).toBeInTheDocument();
  });

  it('renders Skipped status badge when meal is marked as SKIPPED', () => {
    render(<MealCard {...defaultProps} mealLogs={[{ id: 'log-2', status: 'SKIPPED' }]} />);

    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });

  it.each(['DONE', 'SKIPPED'] as const)(
    'hides swap for %s and restores it after the saved status resets',
    async (status) => {
      const onStatusToggle = vi.fn().mockResolvedValue(undefined);
      const onSwapClick = vi.fn();
      const props = { ...defaultProps, onStatusToggle, onSwapClick };
      const { rerender } = render(<MealCard {...props} mealLogs={[{ id: 'log-1', status }]} />);
      const open = () => fireEvent.click(screen.getByRole('button', { name: /open Sinigang na Hipon details/i }));
      open();
      expect(screen.queryByRole('button', { name: 'Swap meal' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Reset meal status' }));
      expect(onStatusToggle).toHaveBeenCalledWith('meal-1', 'PENDING');
      await waitFor(() => expect(screen.queryByRole('button', { name: 'Reset meal status' })).not.toBeInTheDocument());
      rerender(<MealCard {...props} mealLogs={[{ id: 'log-1', status: 'PENDING' }]} />);
      open();
      fireEvent.click(screen.getByRole('button', { name: 'Swap meal' }));
      expect(onSwapClick).toHaveBeenCalledWith('meal-1');
    }
  );

  it('opens expandable modal and reveals details and ingredients on click', () => {
    render(<MealCard {...defaultProps} />);

    // Click to open card
    const cardButton = screen.getByRole('button', { name: /open Sinigang na Hipon details/i });
    fireEvent.click(cardButton);

    // Modal details should be visible
    expect(screen.getByText('Sour tamarind soup with shrimp and kangkong.')).toBeInTheDocument();
    expect(screen.getByText('Shrimp')).toBeInTheDocument();
    expect(screen.getByText('Kangkong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark as eaten/i })).toBeInTheDocument();
  });

  it('opens the original Panlasang article when the meal has a direct source', () => {
    render(
      <MealCard
        {...defaultProps}
        cookingLink={{
          kind: 'PANLASANG_RECIPE',
          url: 'https://panlasangpinoy.com/sinigang-na-hipon/',
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /open Sinigang na Hipon details/i }));
    expect(screen.getByRole('link', { name: 'View Recipe' })).toHaveAttribute(
      'href',
      'https://panlasangpinoy.com/sinigang-na-hipon/'
    );
  });

  it('renders verifier card with masked PRC license and opens credential modal when clicked', () => {
    const verifier = {
      name: 'Andrea Reyes',
      image: null,
      prcLicenseNumber: '0098765',
      prcLicenseExpiry: '2028-12-31T00:00:00.000Z',
      specialization: 'Clinical Nutrition & Renal Dietetics',
      yearsOfExperience: 8,
      university: 'UP Diliman',
      bio: 'Senior Clinical RND',
    };

    render(
      <MealCard
        {...defaultProps}
        verifier={verifier}
        nutritionistNote="Reduced sodium for renal support."
        reviewedAt="2026-09-17T08:00:00.000Z"
      />
    );

    // Click to open card
    const cardButton = screen.getByRole('button', { name: /open Sinigang na Hipon details/i });
    fireEvent.click(cardButton);

    const attribution = screen.getByRole('region', { name: 'Meal review attribution' });
    expect(within(attribution).getByText('Verified by')).toBeInTheDocument();
    expect(screen.getByText(/PRC Lic\. No\. ••••••8765/i)).toBeInTheDocument();
    expect(screen.getByText(/Reduced sodium for renal support\./i)).toBeInTheDocument();

    // Click to open verifier credential modal
    const verifierBtn = within(attribution).getByRole('button', { name: /Reviewed by Andrea Reyes, RND/i });
    fireEvent.click(verifierBtn);

    // NutritionistCredentialModal should be visible
    expect(screen.getByText('Recorded RND review')).toBeInTheDocument();
    expect(screen.getByText('Clinical Nutrition & Renal Dietetics')).toBeInTheDocument();
    expect(screen.getByText('UP Diliman')).toBeInTheDocument();
  });

  it('does not attribute an approved meal to an RND when no reviewer was supplied', () => {
    render(<MealCard {...defaultProps} status="APPROVED" />);
    fireEvent.click(screen.getByRole('button', { name: /open Sinigang na Hipon details/i }));
    expect(screen.queryByText('Verified by')).not.toBeInTheDocument();
    expect(screen.queryByText('Andrea Reyes, RND')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view clinical credentials/i })).not.toBeInTheDocument();
    expect(screen.getByText('No RND review recorded for this meal.')).toBeInTheDocument();
  });

  it.each(['RECIPE', 'MEMBER'] as const)(
    'shows %s attribution before nutrition without inventing credentials',
    (scope) => {
      render(
        <MealCard
          {...defaultProps}
          verifier={{ name: 'Recorded Reviewer', reviewScope: scope, prcLicenseNumber: '', prcLicenseExpiry: '' }}
          defaultOpen
        />
      );
      const attribution = screen.getByRole('region', { name: 'Meal review attribution' });
      expect(attribution.parentElement?.firstElementChild).toBe(attribution);
      expect(
        within(attribution).getByText(scope === 'MEMBER' ? /Your meal approval/ : /Recipe review/)
      ).toBeInTheDocument();
      expect(
        screen.queryByText(/Clinical Dietetics & Nutrition|PRC-Verified|PRC-Licensed RND/)
      ).not.toBeInTheDocument();
      fireEvent.click(within(attribution).getByRole('button', { name: /Reviewed by Recorded Reviewer, RND/ }));
      expect(screen.getByRole('dialog', { name: 'Credentials of Recorded Reviewer' })).toBeInTheDocument();
      expect(screen.getAllByText('Not recorded').length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('button', { name: 'Close credential details' }));
      expect(screen.getByRole('button', { name: 'Mark as eaten' })).toBeInTheDocument();
    }
  );

  it('keeps pending meals without a recorded RND unattributed', () => {
    render(<MealCard {...defaultProps} status="PENDING_REVIEW" defaultOpen />);
    const attribution = screen.getByRole('region', { name: 'Meal review attribution' });
    expect(within(attribution).getByText('No RND review recorded for this meal.')).toBeInTheDocument();
    expect(within(attribution).queryByRole('button')).not.toBeInTheDocument();
  });
});

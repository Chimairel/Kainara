import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { PendingMealPreview } from '@/components/user/PendingMealPreviewCard';
import { DashboardMealRow } from './DashboardMealRow';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imgProps = { ...props };
    delete imgProps.fill;
    delete imgProps.priority;
    return React.createElement('img', imgProps);
  },
}));

const pending: PendingMealPreview = {
  mealName: 'Crab Meat Omelette',
  mealType: 'BREAKFAST',
  description: 'Pending recipe preview',
  calories: 717,
  proteinG: 25,
  carbsG: 105,
  fatG: 22,
  scheduledDate: '2026-10-03',
  ingredients: [{ ingredientName: 'Crab meat', category: 'Fish & Shellfish' }],
  image: {
    url: '/meals/synthetic-crab-omelette.jpg',
    altText: 'Crab Meat Omelette source photo',
    kind: 'EXACT',
    attribution: {
      creator: 'Synthetic source fixture',
      licenseCode: 'SOURCE_REFERENCE',
      sourcePageUrl: 'https://example.invalid/crab-omelette',
      licenseUrl: null,
      modifications: null,
    },
  },
};

describe('DashboardMealRow pending images', () => {
  it('shows the supplied recipe photo without enabling approved-meal actions', () => {
    const { container } = render(<DashboardMealRow meal={pending} pending />);
    const image = screen.getByRole('img', { name: 'Crab Meat Omelette source photo' });
    expect(image).toHaveAttribute('src', pending.image!.url);
    fireEvent.load(image);
    expect(screen.getByText('Pending review')).toBeInTheDocument();
    expect(container.querySelector('details summary')).toHaveTextContent(pending.mealName);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText('Approved')).not.toBeInTheDocument();
  });

  it('keeps a category placeholder when the photo is absent or fails', () => {
    const { rerender } = render(<DashboardMealRow meal={pending} pending />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Crab Meat Omelette .*visual placeholder/)).toBeInTheDocument();
    rerender(<DashboardMealRow meal={{ ...pending, image: null }} pending />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('Pending review')).toBeInTheDocument();
  });
});

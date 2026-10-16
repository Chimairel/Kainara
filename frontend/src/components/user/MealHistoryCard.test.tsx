import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import MealHistoryCard from './MealHistoryCard';
import type { MealHistoryLog } from '@/features/meals/useMealsWorkspace';

vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const imgProps = { ...props };
    delete imgProps.fill;
    delete imgProps.priority;
    return React.createElement('img', imgProps);
  },
}));

const baseLog: MealHistoryLog = {
  id: 'log-101',
  loggedAt: '2026-09-07T08:00:00.000Z',
  mealName: 'Hearty Pandesal with Peanut Butter, Boiled Eggs, and Butter',
  source: 'SYSTEM_GENERATED',
  status: 'DONE',
  calories: 859,
  proteinG: 40,
  carbsG: 75,
  fatG: 22,
  notes: 'Felt very energized after eating',
  mealType: 'BREAKFAST',
};

describe('MealHistoryCard', () => {
  it('shows the linked recipe photo and the same display title as Dashboard without changing intake', () => {
    const image = {
      url: 'https://panlasangpinoy.com/wp-content/uploads/2026/10/bam-i.jpg',
      altText: 'Bam-I source recipe',
      kind: 'EXACT' as const,
      attribution: {
        creator: 'Panlasang Pinoy',
        sourcePageUrl: 'https://panlasangpinoy.com/bam-i/',
        licenseCode: 'SOURCE_REFERENCE',
        licenseUrl: null,
        modifications: null,
      },
    };
    render(<MealHistoryCard log={{ ...baseLog, mealName: 'Bam-I Recipe', image }} />);
    expect(screen.getByRole('img', { name: image.altText })).toHaveAttribute('src', image.url);
    expect(screen.getByText('Bam-I')).toBeInTheDocument();
    expect(screen.queryByText('Bam-I Recipe')).not.toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveTextContent('859 kcal');
    fireEvent.error(screen.getByRole('img', { name: image.altText }));
    expect(screen.getByLabelText('Bam-I (photo unavailable)')).toBeInTheDocument();
  });
  it('does not label an old log without a recorded meal type as lunch', () => {
    render(<MealHistoryCard log={{ ...baseLog, mealType: undefined }} />);
    expect(screen.getByText('Meal')).toBeInTheDocument();
    expect(screen.queryByText('Lunch')).not.toBeInTheDocument();
  });
  it('renders category, meal title, macros, and existing note preview', () => {
    render(<MealHistoryCard log={baseLog} />);

    expect(screen.getByText('Breakfast')).toBeInTheDocument();
    expect(screen.getByText('Hearty Pandesal with Peanut Butter, Boiled Eggs, and Butter')).toBeInTheDocument();
    expect(screen.getByRole('article')).toHaveTextContent('859 kcal');
    expect(screen.getByRole('article')).toHaveTextContent('40g protein');
    expect(screen.queryByText(/Felt very energized after eating/i)).not.toBeInTheDocument();
    expect(screen.getByText('DONE')).toBeInTheDocument();
  });

  it('reuses the expanded notes area for feedback without exposing an editor', () => {
    render(<MealHistoryCard log={baseLog} />);
    fireEvent.click(screen.getByRole('button', { expanded: false }));
    expect(screen.getByRole('region', { name: 'RND feedback' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Note/ })).not.toBeInTheDocument();
  });
});

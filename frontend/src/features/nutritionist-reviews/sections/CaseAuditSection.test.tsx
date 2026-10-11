import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CaseAuditSection from './CaseAuditSection';
import type { DetailData } from '../review-types';
vi.mock('next/image', () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => {
    const clean = { ...props };
    delete clean.fill;
    delete clean.priority;
    return React.createElement('img', clean);
  },
}));
it('shows the saved source photo in the review canvas and preserves its attribution and honest failure fallback', () => {
  const detailData = {
    mealPlan: {
      mealName: 'Synthetic Hotsilog',
      mealType: 'BREAKFAST',
      description: 'Saved synthetic recipe',
      calories: 500,
      proteinG: 20,
      carbsG: 60,
      fatG: 18,
      image: {
        url: 'https://panlasangpinoy.com/wp-content/uploads/2026/10/hotsilog.jpg',
        altText: 'Saved source photo',
        kind: 'EXACT',
        attribution: {
          creator: 'Panlasang Pinoy',
          sourcePageUrl: 'https://panlasangpinoy.com/hotsilog/',
          licenseCode: null,
          licenseUrl: null,
          modifications: null,
        },
      },
    },
    ingredients: [],
  } as unknown as DetailData;
  render(<CaseAuditSection model={{ detailData }} paper />);
  const photo = screen.getByRole('img', { name: 'Saved source photo' });
  expect(photo).toHaveAttribute('src', detailData.mealPlan.image!.url);
  expect(screen.getByRole('link', { name: /source/i })).toHaveAttribute(
    'href',
    detailData.mealPlan.image!.attribution.sourcePageUrl
  );
  fireEvent.error(photo);
  expect(screen.queryByRole('img', { name: 'Saved source photo' })).not.toBeInTheDocument();
  expect(screen.getByText(/Recipe photo coming soon/)).toBeInTheDocument();
});

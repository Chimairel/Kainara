import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import ReviewQualificationsPanel from './ReviewQualificationsPanel';

it('shows shared access and verified zero years with no opt-out switch', () => {
  render(<ReviewQualificationsPanel verifiedExpertise={['HEART_CONDITION']} verifiedExperienceYears={0} />);
  expect(screen.getByText('Heart health nutrition')).toBeInTheDocument();
  expect(screen.getByText('0 verified years of experience')).toBeInTheDocument();
  expect(screen.getByText(/Expertise, experience and online status do not affect access/)).toBeInTheDocument();
  expect(screen.queryByRole('switch')).not.toBeInTheDocument();
});

it('does not invent expertise or years when they are unverified', () => {
  render(<ReviewQualificationsPanel />);
  expect(screen.getByText('No specialist expertise verified yet.')).toBeInTheDocument();
  expect(screen.queryByText(/\d+ verified years/)).not.toBeInTheDocument();
});

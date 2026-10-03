import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import WeightGraph from './WeightGraph';

it('renders an onboarding marker immediately and adds a line only after another observation', () => {
  const baseline = {
    weightKg: 57,
    loggedAt: '2026-10-04T02:00:00Z',
    source: 'ONBOARDING',
    dateLabel: 'Starting weight',
  };
  const { container, rerender } = render(<WeightGraph groupedLogs={[baseline]} targetWeight={65} />);
  expect(screen.getByRole('img', { name: 'Weight progress chart' })).toBeInTheDocument();
  expect(screen.getByText(/Starting weight: 57 kg/)).toHaveTextContent('From onboarding');
  expect(screen.getByText(/Log your next weight to see the trend/)).toBeInTheDocument();
  expect(container.querySelectorAll('circle')).toHaveLength(1);
  expect(container.querySelectorAll('path')).toHaveLength(0);
  rerender(
    <WeightGraph
      groupedLogs={[baseline, { weightKg: 58, loggedAt: '2026-10-05T02:00:00Z', dateLabel: 'Wk of Oct 4' }]}
      targetWeight={65}
    />
  );
  expect(container.querySelectorAll('circle')).toHaveLength(2);
  expect(container.querySelectorAll('path')).toHaveLength(2);
});

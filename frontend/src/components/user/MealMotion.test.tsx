import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { MealMotionDiv, useMealMotion } from './MealMotion';
import MealCard from './MealCard';
import PendingMealPreviewCard from './PendingMealPreviewCard';

afterEach(() => vi.unstubAllGlobals());

function mediaFixture(width: number, reduced = false) {
  const listeners = new Set<() => void>();
  const media = {
    get matches() {
      return width >= 768 && !reduced;
    },
    addEventListener: (_event: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_event: string, callback: () => void) => listeners.delete(callback),
  };
  vi.stubGlobal('matchMedia', (query: string) =>
    query === '(prefers-reduced-motion)' ? { matches: reduced, addListener: () => {}, removeListener: () => {} } : media
  );
  return (nextWidth: number, nextReduced = false) => {
    width = nextWidth;
    reduced = nextReduced;
    act(() => listeners.forEach((callback) => callback()));
  };
}

it('adapts meal motion to mobile, desktop and changes in reduced-motion preference', () => {
  const change = mediaFixture(390);
  function Harness() {
    const enabled = useMealMotion();
    return (
      <>
        <output>{enabled ? 'Animated' : 'Immediate'}</output>
        <MealMotionDiv enabled={enabled} initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="meal-layer">
          Details
        </MealMotionDiv>
      </>
    );
  }
  render(<Harness />);
  expect(screen.getByText('Immediate')).toBeInTheDocument();
  expect(screen.getByTestId('meal-layer').style.opacity).toBe('');
  expect(screen.getByTestId('meal-layer')).not.toHaveAttribute('initial');
  change(1440);
  expect(screen.getByText('Animated')).toBeInTheDocument();
  change(1440, true);
  expect(screen.getByText('Immediate')).toBeInTheDocument();
  expect(screen.getByTestId('meal-layer').style.opacity).toBe('');
  change(767);
  expect(screen.getByText('Immediate')).toBeInTheDocument();
  change(768);
  expect(screen.getByText('Animated')).toBeInTheDocument();
});

it.each(['planned', 'pending'] as const)('opens and closes %s meal details immediately on mobile', (kind) => {
  mediaFixture(390);
  const meal = {
    mealName: 'Synthetic meal',
    mealType: 'LUNCH' as const,
    description: 'Synthetic serving details',
    calories: 400,
    proteinG: 20,
    carbsG: 50,
    fatG: 10,
    ingredients: [],
    scheduledDate: new Date().toISOString(),
  };
  render(
    kind === 'planned' ? (
      <MealCard {...meal} id="motion-fixture" status="APPROVED" aiConfidenceFlag="SAFE" />
    ) : (
      <PendingMealPreviewCard meal={meal} />
    )
  );
  fireEvent.click(screen.getByRole('button', { name: /Open Synthetic meal/ }));
  const close = screen.getByRole('button', { name: 'Close modal' });
  const panel = close.closest('.max-w-2xl')!;
  expect((panel as HTMLElement).style.transform).toBe('');
  expect((panel as HTMLElement).style.opacity).toBe('');
  expect(within(panel as HTMLElement).getByText('Synthetic serving details')).toBeVisible();
  expect(document.body.style.overflow).toBe('hidden');
  fireEvent.click(close);
  expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
  expect(document.body.style.overflow).not.toBe('hidden');
  fireEvent.click(screen.getByRole('button', { name: /Open Synthetic meal/ }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('button', { name: 'Close modal' })).not.toBeInTheDocument();
});

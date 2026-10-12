import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import DashboardContent from './DashboardContent';
import type { useDashboardWorkspace } from './useDashboardWorkspace';

vi.mock('@/lib/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('./CockpitDashboard', () => ({
  CockpitDashboard: ({ preparingSlots }: { preparingSlots: { mealType: string }[] }) => (
    <section aria-label="Loaded menu">
      {preparingSlots.map((slot) => (
        <p key={slot.mealType}>{slot.mealType} preparing</p>
      ))}
    </section>
  ),
}));
afterEach(() => vi.useRealTimers());
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
function model() {
  return {
    user: { userId: 'fixture' },
    isLoading: false,
    profileReviewStatus: 'ready',
    generationStatus: 'GENERATING',
    currentCycle: { id: 'cycle', startDate: today, endDate: today },
    currentMeals: [{ id: 'breakfast' }],
    retainedMealLogs: [],
    awaitingGenerationSlots: [{ scheduledDate: today, mealType: 'LUNCH' }],
    activeDate: new Date(`${today}T04:00:00Z`),
    metrics: { mealsList: [] },
    daySelectors: [],
    router: { push: vi.fn() },
  } as unknown as ReturnType<typeof useDashboardWorkspace>;
}
describe('dashboard cooking transition', () => {
  it('extends past five seconds until today is filled, then shows later-day skeletons', () => {
    vi.useFakeTimers();
    const input = model();
    const view = render(<DashboardContent model={input} />);
    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.getByText('Preparing your meal plan')).toBeInTheDocument();
    input.awaitingGenerationSlots = [{ scheduledDate: '2099-12-01', mealType: 'DINNER' }];
    view.rerender(<DashboardContent model={input} />);
    expect(screen.getByLabelText('Loaded menu')).toBeInTheDocument();
    input.activeDate = new Date('2099-12-01T04:00:00Z');
    view.rerender(<DashboardContent model={input} />);
    expect(screen.getByText('DINNER preparing')).toBeInTheDocument();
    expect(screen.queryByText('Preparing your meal plan')).not.toBeInTheDocument();
  });
  it('does not shorten the intro when a complete day includes retained eaten meals', () => {
    vi.useFakeTimers();
    const input = model();
    const view = render(<DashboardContent model={input} />);
    input.awaitingGenerationSlots = [];
    input.retainedMealLogs = [
      { id: 'retained-lunch', scheduledDate: today, status: 'DONE' },
    ] as typeof input.retainedMealLogs;
    input.generationStatus = 'COMPLETED';
    view.rerender(<DashboardContent model={input} />);
    act(() => vi.advanceTimersByTime(4_999));
    expect(screen.queryByLabelText('Loaded menu')).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByLabelText('Loaded menu')).toBeInTheDocument();
  });
  it('does not hold a failed preparation behind cooking or show loading slots after failure', () => {
    vi.useFakeTimers();
    const input = model();
    const view = render(<DashboardContent model={input} />);
    input.generationStatus = 'FAILED';
    view.rerender(<DashboardContent model={input} />);
    expect(screen.getByLabelText('Loaded menu')).toBeInTheDocument();
    expect(screen.queryByText('LUNCH preparing')).not.toBeInTheDocument();
  });
});

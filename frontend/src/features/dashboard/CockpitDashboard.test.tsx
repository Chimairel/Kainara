import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CockpitDashboard, type CockpitDashboardProps } from './CockpitDashboard';
import type { MealPlan } from '@/types';

vi.mock('@/lib/context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
vi.mock('@/components/user/MealImage', () => ({ default: () => <span>Meal visual</span> }));
const meal = {
  id: 'approved',
  mealName: 'Approved rice plate',
  mealType: 'LUNCH',
  status: 'APPROVED',
  calories: 400,
  proteinG: 20,
  carbsG: 50,
  fatG: 10,
  mealLogs: [],
} as unknown as MealPlan;
function props(): CockpitDashboardProps {
  return {
    activeDate: new Date('2026-09-10T04:00:00Z'),
    meals: [meal],
    pendingMeals: [
      {
        mealName: 'Pending soup',
        mealType: 'DINNER',
        description: null,
        calories: 300,
        proteinG: 15,
        carbsG: 40,
        fatG: 8,
        scheduledDate: '2026-09-10',
        ingredients: [],
      },
    ],
    metrics: {
      caloriesConsumed: 100,
      caloriesTarget: 1800,
      proteinConsumed: 10,
      proteinTarget: 90,
      carbsConsumed: 20,
      carbsTarget: 200,
      fatConsumed: 2,
      fatTarget: 60,
      provisionalCalories: 100,
      unresolvedMealCount: 1,
    },
    waterIntake: 250,
    onAddWater: vi.fn(),
    onMealClick: vi.fn(),
    onStatusToggle: vi.fn(),
    onOpenWeeklyPlan: vi.fn(),
  };
}
describe('CockpitDashboard', () => {
  it('orders a shuffled mixed menu as breakfast, lunch, dinner without changing input arrays', () => {
    const input = props();
    input.meals = [{ ...meal, id: 'dinner', mealName: 'Dinner dish', mealType: 'DINNER' }, meal];
    input.pendingMeals = [{ ...input.pendingMeals![0], mealName: 'Breakfast dish', mealType: 'BREAKFAST' }];
    const { container } = render(<CockpitDashboard {...input} />);
    const text = container.textContent!;
    expect(text.indexOf('Breakfast dish')).toBeLessThan(text.indexOf('Approved rice plate'));
    expect(text.indexOf('Approved rice plate')).toBeLessThan(text.indexOf('Dinner dish'));
    expect(input.meals[0].mealType).toBe('DINNER');
    expect(screen.queryByRole('button', { name: /Mark Breakfast dish/ })).not.toBeInTheDocument();
  });
  it('shows pending meals beside approved meals without giving pending previews logging actions', () => {
    render(<CockpitDashboard {...props()} />);
    expect(screen.getByText('Pending soup')).toBeInTheDocument();
    expect(screen.getByText('Approved rice plate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark Pending soup/ })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Unresolved items are excluded');
  });
  it('keyboard logging does not open details and detail navigation remains keyboard accessible', async () => {
    const callbacks = props();
    const user = userEvent.setup();
    const { container } = render(<CockpitDashboard {...callbacks} />);
    expect(container.querySelector('button button')).toBeNull();
    screen.getByRole('button', { name: 'Mark Approved rice plate as eaten' }).focus();
    await user.keyboard('{Enter}');
    expect(callbacks.onStatusToggle).toHaveBeenCalledWith('approved', 'DONE');
    expect(callbacks.onMealClick).not.toHaveBeenCalled();
    screen.getByRole('button', { name: 'Open Approved rice plate details' }).focus();
    await user.keyboard(' ');
    expect(callbacks.onMealClick).toHaveBeenCalledWith('approved');
  });
  it('exposes explicit water controls without the removed summary cards', async () => {
    const callbacks = props();
    callbacks.activeDate = new Date();
    const user = userEvent.setup();
    render(<CockpitDashboard {...callbacks} />);
    await user.click(screen.getByRole('button', { name: 'Add 250 mL of water' }));
    expect(callbacks.onAddWater).toHaveBeenCalledWith(250);
    expect(screen.queryByText('Weight & progress')).not.toBeInTheDocument();
    expect(screen.queryByText('Weekly check-in')).not.toBeInTheDocument();
  });
  it.each([-1, 1])('does not display today’s hydration as the selected non-current day (%s)', async (offset) => {
    const callbacks = props();
    const date = new Date();
    date.setDate(date.getDate() + offset);
    callbacks.activeDate = date;
    render(<CockpitDashboard {...callbacks} />);
    expect(screen.getByText(/Water logging is available for today/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Water log')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add 250 mL of water' })).not.toBeInTheDocument();
    expect(callbacks.onAddWater).not.toHaveBeenCalled();
  });
  it('offers expandable pending previews without a logging action and names every macro', () => {
    const { container } = render(<CockpitDashboard {...props()} />);
    expect(container.querySelector('details summary')).toHaveTextContent('Pending soup');
    expect(screen.getByText('Protein')).toBeInTheDocument();
    expect(screen.getByText('Carbs')).toBeInTheDocument();
    expect(screen.getByText('Fat')).toBeInTheDocument();
    expect(screen.getByText('Estimated (Outside)')).toBeInTheDocument();
  });
});

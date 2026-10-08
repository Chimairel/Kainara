import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import type { CockpitDashboardProps } from './CockpitDashboard';
import DashboardPage from '@/app/(user)/dashboard/page';

const fixture = vi.hoisted(() => ({
  user: {
    userId: 'dashboard-refactor-fixture',
    name: 'Fixture Member',
    role: 'USER',
    onboardingDone: true,
    tosAccepted: true,
    reportAcknowledged: true,
  },
  profile: { userProfile: { dailyCalorieTarget: 2000, safetyRevision: 1 } },
  eligibility: { required: false, approved: true },
  router: { push: vi.fn() },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: fixture.user }) }));
vi.mock('next/navigation', () => ({ useRouter: () => fixture.router }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('@/lib/user-profile-resource', () => ({
  cachedUserProfile: () => fixture.profile,
  getRecentUserProfile: async () => fixture.profile,
}));
vi.mock('@/lib/clinical-profile-status', () => ({
  cachedClinicalProfileStatus: () => fixture.eligibility,
  refreshClinicalProfileStatus: async () => fixture.eligibility,
}));
vi.mock('@/features/navigation/useDashboardPreload', () => ({ useDashboardPreload: () => undefined }));
vi.mock('./useOutsideMealLog', () => ({
  useOutsideMealLog: () => ({ isLoading: false, setIsOpen: vi.fn() }),
}));
vi.mock('./OutsideMealModal', () => ({ OutsideMealModal: () => null }));
// Keep page/hook/polling/sections real; isolate the separately tested meal presentation.
vi.mock('./CockpitDashboard', () => ({
  CockpitDashboard: (props: CockpitDashboardProps) => (
    <section aria-label="Loaded menu">
      <output aria-label="Consumed calories">{props.metrics.caloriesConsumed}</output>
      {props.pendingMeals?.map((meal) => (
        <p key={meal.mealName}>Preview: {meal.mealName}</p>
      ))}
      {props.meals.map((meal) => (
        <button
          key={meal.id}
          onClick={() => props.onStatusToggle?.(meal.id, meal.mealLogs?.[0]?.status === 'DONE' ? 'PENDING' : 'DONE')}
        >
          {meal.mealLogs?.[0]?.status === 'DONE' ? 'Reset' : 'Eat'} {meal.mealName}
        </button>
      ))}
    </section>
  ),
}));

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);
const patch = vi.mocked(api.patch);
const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
const meal = {
  id: 'fixture-plate',
  mealName: 'Fixture rice plate',
  mealType: 'LUNCH',
  status: 'APPROVED',
  scheduledDate: `${dateKey}T04:00:00Z`,
  calories: 500,
  proteinG: 20,
  carbsG: 60,
  fatG: 10,
  mealLogs: [],
};
let plan: { data: unknown[]; meta: Record<string, unknown> };

beforeEach(() => {
  clearSessionResourceCache();
  vi.clearAllMocks();
  fixture.user.reportAcknowledged = true;
  fixture.eligibility = { required: false, approved: true };
  plan = { data: [], meta: { generationStatus: 'GENERATING' } };
  get.mockImplementation(async (url) => {
    if (url === '/user/meals/current') return { data: { success: true, ...plan } };
    if (url === '/user/meals/cycles') return { data: { success: true, data: { upcoming: null } } };
    if (url === '/user/water/today') return { data: { success: true, data: { totalMl: 0 } } };
    return { data: { success: true, data: [] } };
  });
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});

async function refresh() {
  await act(async () => {
    window.dispatchEvent(new Event(LIVE_UPDATE_EVENT));
  });
}

describe('dashboard route after feature extraction', () => {
  it('hides food logging and weekly plan actions until the report is acknowledged', async () => {
    fixture.user.reportAcknowledged = false;
    const view = render(<DashboardPage />);
    await screen.findByText("Meal planning isn't available yet");
    expect(screen.queryByRole('button', { name: /Log food or snack/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Weekly plan/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View Nutrition Report/i })).toBeInTheDocument();
    fixture.user.reportAcknowledged = true;
    view.rerender(<DashboardPage />);
    expect(await screen.findByRole('button', { name: /Log food or snack/i })).toBeInTheDocument();
  });
  it('refreshes a preparing page into its saved meals without remounting or manual reload', async () => {
    render(<DashboardPage />);
    await screen.findByText('Preparing Your First Meal Plan');
    plan = { data: [meal], meta: { generationStatus: 'COMPLETED' } };
    await refresh();
    expect(await screen.findByRole('button', { name: 'Eat Fixture rice plate' })).toBeInTheDocument();
    expect(screen.queryByText('Preparing Your First Meal Plan')).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('refreshes into failure and routes retry results to pending previews', async () => {
    render(<DashboardPage />);
    await screen.findByText('Preparing Your First Meal Plan');
    plan = { data: [], meta: { generationStatus: 'FAILED' } };
    await refresh();
    const retry = await screen.findByRole('button', { name: 'Retry Preparation' });
    post.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          meals: [],
          generationStatus: 'COMPLETED',
          pendingReview: {
            mealCount: 1,
            planType: 'STARTER',
            reviewStatus: 'PENDING_REVIEW',
            meals: [meal],
          },
        },
      },
    });
    fireEvent.click(retry);
    expect(await screen.findByText('Preview: Fixture rice plate')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Eat Fixture rice plate' })).not.toBeInTheDocument();
    expect(post).toHaveBeenCalledWith('/user/meals/generate');
  });

  it('retains the profile review gate and does not expose a loaded menu or trigger generation', async () => {
    fixture.eligibility = { required: true, approved: false };
    plan = { data: [meal], meta: { generationStatus: 'COMPLETED' } };
    render(<DashboardPage />);
    await screen.findByText(/An RND needs to review your declared health profile/);
    expect(screen.queryByRole('region', { name: 'Loaded menu' })).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it('refreshes the menu and calorie total after marking eaten and resetting status', async () => {
    plan = { data: [meal], meta: { generationStatus: 'COMPLETED' } };
    patch.mockImplementation(async (_url, body) => {
      const { status } = body as { status: 'DONE' | 'PENDING' };
      plan = { ...plan, data: [{ ...meal, mealLogs: [{ status }] }] };
      return { data: { success: true } };
    });
    render(<DashboardPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Eat Fixture rice plate' }));
    await waitFor(() => expect(screen.getByLabelText('Consumed calories')).toHaveTextContent('500'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Fixture rice plate' }));
    await waitFor(() => expect(screen.getByLabelText('Consumed calories')).toHaveTextContent('0'));
    expect(patch).toHaveBeenNthCalledWith(1, '/user/meals/fixture-plate/status', { status: 'DONE' });
    expect(patch).toHaveBeenNthCalledWith(2, '/user/meals/fixture-plate/status', { status: 'PENDING' });
  });
});

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MembershipGate from './MembershipGate';
import MembershipNotice from './MembershipNotice';
import Pricing from '@/components/ui/pricing';
import MembershipPage from '@/app/(user)/membership/page';
import type { MembershipView } from './MembershipProvider';

const state = vi.hoisted(() => ({
  data: null as MembershipView | null,
  isLoading: false,
  error: null as string | null,
  refresh: vi.fn(),
}));
vi.mock('./MembershipProvider', () => ({ useMembership: () => state }));
// The real custom-element animation is exercised in Chromium.
vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>₱{value.toLocaleString('en-PH')}</span>,
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: {
      userId: 'membership-ui-fixture',
      role: 'USER',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      reportAcknowledged: true,
    },
  }),
}));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn().mockResolvedValue({ data: { data: {} } }) } }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
function view(): Extract<MembershipView, { enabled: true }> {
  return {
    enabled: true,
    level: 'TRIAL',
    enhanced: true,
    requiresCaseReview: false,
    serverTime: '2026-10-01T00:00:00.000Z',
    trialStartedAt: '2026-09-02T00:00:00.000Z',
    trialEndsAt: '2026-10-02T00:00:00.000Z',
    paidUntil: null,
    resetsAt: '2026-10-04T16:00:00.000Z',
    purchasesAvailable: false,
    autoRenews: false,
    price: null,
    limits: {
      freeSwaps: 3,
      freeEstimates: 2,
      lifestyleSwaps: 10,
      healthSwaps: 21,
      memberEstimates: 10,
      memberPlanReviews: 1,
      memberOutsideReviews: 1,
    },
    usage: {
      AI_ESTIMATE: { used: 4, cap: 10, remaining: 6 },
      PLAN_REVIEW: { used: 0, cap: 1, remaining: 1 },
      OUTSIDE_REVIEW: { used: 0, cap: 1, remaining: 1 },
    },
    swaps: { used: 1, cap: 21, remaining: 20 },
  };
}
beforeEach(() => {
  state.data = view();
  state.isLoading = false;
  state.error = null;
  state.refresh.mockClear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  sessionStorage.clear();
});
describe('membership status and gates', () => {
  it('shows configured Nara credits separately from outside estimates and hides them when disabled', () => {
    state.data = { ...view(), assistant: { enabled: true, weeklyCredits: { FREE: 4, LIFESTYLE: 12, HEALTH: 24 },
      allowance: { used: 3, cap: 24, remaining: 21 } } };
    const rendered = render(<MembershipPage />);
    expect(screen.getByLabelText('Nara AI credits: 21 of 24 remaining')).toBeInTheDocument();
    expect(screen.getByLabelText('Outside-food AI estimates: 6 of 10 remaining')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'View plans' })[0]);
    for (const cap of [4, 12, 24]) expect(screen.getByText(`${cap} Nara AI credits per week`)).toBeInTheDocument();
    expect(screen.getByText('Free Nara app help without credits')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    state.data = { ...view(), assistant: { enabled: false } };
    rendered.rerender(<MembershipPage />);
    expect(screen.queryByText('Nara AI credits')).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'View plans' })[0]);
    expect(screen.queryByText(/Nara AI credits per week/)).not.toBeInTheDocument();
  });
  it('explains each planning benefit without treating individual assessment as guaranteed support', () => {
    render(<MembershipPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'View plans' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Lifestyle planning details' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Activity level, weight loss');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Supported allergy changes: shellfish');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Membership plans' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Health planning details' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('shellfish (including shrimp)');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Individual assessment: kidney disease');
    expect(screen.getByRole('tooltip')).toHaveTextContent('Planning depends on RND clearance');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('keeps plans out of the allowance view and opens the shared accessible plan dialog', () => {
    render(<MembershipPage />);
    expect(screen.getByLabelText('Outside-food AI estimates: 6 of 10 remaining')).toBeInTheDocument();
    expect(screen.getByLabelText('Meal swaps: 20 of 21 remaining')).toBeInTheDocument();
    expect(screen.queryByText('Replans')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Get Lifestyle', hidden: true })).not.toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'View plans' })[0]);
    expect(screen.getByRole('dialog', { name: 'Membership plans' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Lifestyle' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Get Health' })).toBeEnabled();
    expect(
      within(screen.getByRole('article', { name: 'Lifestyle plan' })).getByText('Recommended')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Health plan' })).queryByText('Recommended')
    ).not.toBeInTheDocument();
    expect(screen.getByText('10 meal swaps per cycle')).toBeInTheDocument();
    expect(screen.getByText('21 meal swaps per cycle')).toBeInTheDocument();
    expect(screen.queryByText(/optional replans/i)).not.toBeInTheDocument();
    expect(screen.getByText('10 outside-food AI estimates per week')).toBeInTheDocument();
    expect(screen.getByText('1 RND plan review per week')).toBeInTheDocument();
    expect(screen.getByText('1 outside food review per week')).toBeInTheDocument();
    expect(screen.getByText(/Monday at midnight \(Philippine time\)/)).toBeInTheDocument();
    expect(
      screen.queryByText(/per Manila week|development payment sandbox|Demo checkout uses/i)
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('recommends Health for declared restrictions and updates when the current profile no longer needs case review', () => {
    state.data = { ...view(), requiresCaseReview: true };
    const rendered = render(<MembershipPage />);
    fireEvent.click(screen.getAllByRole('button', { name: 'View plans' })[0]);
    expect(within(screen.getByRole('article', { name: 'Health plan' })).getByText('Recommended')).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Lifestyle plan' })).queryByText('Recommended')
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Health plan needed' })).toBeDisabled();
    expect(screen.getByText(/Your health details require RND review/)).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Health plan' })).getByText('₱999')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Yearly Billing/ }));
    expect(within(screen.getByRole('article', { name: 'Health plan' })).getByText('₱9,590')).toBeInTheDocument();
    state.data = { ...view(), requiresCaseReview: false };
    rendered.rerender(<MembershipPage />);
    expect(
      within(screen.getByRole('article', { name: 'Lifestyle plan' })).getByText('Recommended')
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('article', { name: 'Health plan' })).queryByText('Recommended')
    ).not.toBeInTheDocument();
  });
  it('does not guess a member recommendation when membership profile data is unavailable', () => {
    state.data = { enabled: false };
    render(<Pricing />);
    expect(screen.queryByText('Recommended')).not.toBeInTheDocument();
  });
  it('explains waiting for a usable plan rather than starting the trial during review', () => {
    state.data = { ...view(), level: 'TRIAL_PENDING', trialStartedAt: null, trialEndsAt: null };
    render(<MembershipPage />);
    expect(
      within(screen.getByRole('region', { name: 'Current membership overview' })).getByText('Not started')
    ).toBeInTheDocument();
    expect(screen.getByText('Your 30 days start when your meals are ready.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Membership help' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Pending review does not start it');
  });
  it('gates progress after expiry and preserves links to existing records', () => {
    state.data = { ...view(), level: 'FREE', enhanced: false };
    render(
      <MembershipGate benefit="Progress insights">
        <p>Private progress chart</p>
      </MembershipGate>
    );
    expect(screen.queryByText('Private progress chart')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Access your saved records' })).toHaveAttribute('href', '/export');
  });
  it('updates exhausted allowances and current-period expiry from refreshed server state', () => {
    const rendered = render(<MembershipPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh membership status' }));
    expect(state.refresh).toHaveBeenCalledOnce();
    state.data = {
      ...view(),
      level: 'MEMBER',
      tier: 'HEALTH',
      paidUntil: '2026-12-01T00:00:00Z',
      healthUntil: '2026-10-15T00:00:00Z',
      usage: { ...view().usage, PLAN_REVIEW: { used: 1, cap: 1, remaining: 0 } },
    };
    rendered.rerender(<MembershipPage />);
    expect(screen.getByLabelText('Plan reviews: 0 of 1 remaining')).toBeInTheDocument();
    const header = screen.getByRole('region', { name: 'Current membership overview' });
    expect(header).toHaveTextContent('Oct 15, 2026');
    expect(header).not.toHaveTextContent('Dec 1, 2026');
  });
  it('does not render premium content when the first membership check fails', () => {
    state.data = null;
    state.error = 'Membership unavailable';
    render(
      <MembershipGate benefit="Progress insights">
        <p>Private progress chart</p>
      </MembershipGate>
    );
    expect(screen.queryByText('Private progress chart')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(state.refresh).toHaveBeenCalledOnce();
  });
  it('retains the prior access when rollout is disabled', () => {
    state.data = { enabled: false };
    render(
      <MembershipGate benefit="Progress insights">
        <p>Progress chart</p>
      </MembershipGate>
    );
    expect(screen.getByText('Progress chart')).toBeInTheDocument();
  });
});
describe('small trial notice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });
  it('is a dismissible floating notice and stays dismissed across refreshes of membership data', () => {
    const notice = render(<MembershipNotice />);
    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.getByRole('region', { name: 'Your Health plan' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss Your Health plan' }));
    state.data = { ...view(), serverTime: '2026-10-01T00:01:00.000Z' };
    notice.rerender(<MembershipNotice />);
    act(() => vi.advanceTimersByTime(32_000));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
  it('waits for install/auth notices and dialogs to close', () => {
    const blocker = document.createElement('div');
    blocker.dataset.floatingNotice = 'install';
    document.body.append(blocker);
    render(<MembershipNotice />);
    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    blocker.remove();
    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
  it('does not show for active members or while the trial waits for a plan', () => {
    state.data = { ...view(), level: 'MEMBER' };
    const notice = render(<MembershipNotice />);
    act(() => vi.advanceTimersByTime(16_000));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    state.data = { ...view(), level: 'TRIAL_PENDING', trialEndsAt: null };
    notice.rerender(<MembershipNotice />);
    act(() => vi.advanceTimersByTime(16_000));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });
});

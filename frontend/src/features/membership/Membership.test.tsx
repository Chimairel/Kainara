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
    expect(screen.getByRole('tooltip')).toHaveTextContent('Planning depends on nutritionist clearance');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
  it('keeps plans out of the allowance view and opens the shared accessible plan dialog', () => {
    render(<MembershipPage />);
    expect(screen.getByText('6 of 10 left')).toBeInTheDocument();
    expect(screen.getByText('20 of 21 left')).toBeInTheDocument();
    expect(screen.queryByText('Replans')).not.toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'AI estimates used' })).toHaveAttribute('aria-valuenow', '4');
    expect(screen.getByRole('meter', { name: 'AI estimates used' })).toHaveAttribute('aria-valuemax', '10');
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
    expect(screen.getByText('10 AI estimates per week')).toBeInTheDocument();
    expect(screen.getByText('1 nutritionist plan review per week')).toBeInTheDocument();
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
    expect(screen.getByText(/Your health details require nutritionist review/)).toBeInTheDocument();
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
    expect(screen.getByText(/Your 30-day Health plan starts/)).toBeInTheDocument();
    expect(screen.getByText(/A starter plan counts; waiting for review does not/)).toBeInTheDocument();
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

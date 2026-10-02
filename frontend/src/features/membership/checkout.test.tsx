import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Pricing from '@/components/ui/pricing';
import Card, { CardContent, CardHeader } from '@/components/ui/Card';
import { useMembershipCheckout } from './useMembershipCheckout';
import { checkoutSelectionKey, isCheckoutUrl, pendingMembershipSelection } from './checkout';
import { getPostAuthDestination } from '@/lib/post-auth-destination';

const state = vi.hoisted(() => ({
  user: null as null | {
    userId: string;
    role: 'USER';
    emailVerified: boolean;
    onboardingDone: boolean;
    tosAccepted: boolean;
    reportAcknowledged: boolean;
  },
  push: vi.fn(),
  post: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock('@/lib/axios', () => ({
  default: { post: state.post, get: vi.fn().mockResolvedValue({ data: { data: {} } }) },
}));
// NumberFlow uses custom browser elements; browser acceptance exercises the actual animation.
vi.mock('@number-flow/react', () => ({ default: ({ value }: { value: number }) => <span>₱{value}</span> }));
const readyUser = {
  userId: 'checkout-ui-fixture',
  role: 'USER' as const,
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  reportAcknowledged: true,
};
beforeEach(() => {
  state.user = null;
  state.push.mockClear();
  state.post.mockReset();
  sessionStorage.clear();
});

describe('membership checkout UI', () => {
  it('public pricing has no current account labels and remembers the selected yearly plan through login', async () => {
    render(<Pricing />);
    expect(screen.queryByText('Current plan')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Get Free' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Yearly Billing/ }));
    expect(screen.getByRole('button', { name: /Yearly Billing/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Get Health' }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/login'));
    expect(pendingMembershipSelection()).toMatchObject({ tier: 'HEALTH', period: 'YEARLY' });
    expect(getPostAuthDestination(readyUser)).toBe('/membership?plans=true&period=YEARLY&tier=HEALTH');
    expect(getPostAuthDestination({ ...readyUser, onboardingDone: false })).toBe('/onboarding/stats');
    expect(state.post).not.toHaveBeenCalled();
  });
  it('prevents duplicate in-flight checkout and sends selection rather than a client price', async () => {
    state.user = readyUser;
    let fail!: (error: unknown) => void;
    state.post.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        })
    );
    const hook = renderHook(useMembershipCheckout);
    let request!: Promise<void>;
    act(() => {
      request = hook.result.current.start('LIFESTYLE', 'MONTHLY');
      void hook.result.current.start('HEALTH', 'YEARLY');
    });
    expect(state.post).toHaveBeenCalledOnce();
    expect(state.post.mock.calls[0][1]).toEqual({
      tier: 'LIFESTYLE',
      period: 'MONTHLY',
    });
    await act(async () => {
      fail({ response: { data: { errorCode: 'MEMBERSHIP_PURCHASES_UNAVAILABLE' } } });
      await request;
    });
    expect(hook.result.current.error).toMatch(/not configured/);
    expect(hook.result.current.pendingTier).toBeNull();
  });
  it('shows the scheduled trial transition and exact credit before confirming a credit-funded purchase', async () => {
    state.user = readyUser;
    const quote = {
      id: 'quote-fixture',
      tier: 'HEALTH',
      period: 'MONTHLY',
      status: 'QUOTED',
      mode: 'TEST',
      action: 'AFTER_TRIAL',
      amountCentavos: 0,
      listPriceCentavos: 149900,
      creditCentavos: 149900,
      carryoverCentavos: 1000,
      startsAt: '2026-10-20T12:00:00Z',
      endsAt: '2026-11-20T12:00:00Z',
      expiresAt: '2026-10-02T13:00:00Z',
    };
    state.post
      .mockResolvedValueOnce({ data: { data: quote } })
      .mockResolvedValueOnce({ data: { data: { ...quote, status: 'PAID' } } });
    render(<Pricing currentTier="HEALTH" currentLevel="TRIAL" />);
    fireEvent.click(screen.getByRole('button', { name: 'Get Health' }));
    await screen.findByRole('region', { name: 'Payment summary' });
    expect(screen.getByText(/Your Health trial continues/)).toBeInTheDocument();
    expect(state.post).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Use membership credit' }));
    await waitFor(() => expect(state.push).toHaveBeenCalledWith('/membership/checkout?purchase=quote-fixture'));
    expect(state.post.mock.calls[1][1]).toEqual({
      tier: 'HEALTH',
      period: 'MONTHLY',
      quoteId: 'quote-fixture',
      requestKey: expect.any(String),
    });
  });
  it('rejects an unexpected payment redirect', async () => {
    state.user = readyUser;
    state.post.mockResolvedValue({ data: { data: { mode: 'TEST', checkoutUrl: 'https://attacker.example.com' } } });
    const hook = renderHook(useMembershipCheckout);
    await act(async () => {
      await hook.result.current.start('HEALTH', 'YEARLY');
    });
    expect(hook.result.current.error).toMatch(/could not be opened/);
    expect(isCheckoutUrl('https://checkout.paymongo.com.example.com')).toBe(false);
  });
  it('cancels an in-flight checkout when the account changes', async () => {
    state.user = readyUser;
    let complete!: (value: unknown) => void;
    state.post.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    const hook = renderHook(useMembershipCheckout);
    let request!: Promise<void>;
    act(() => {
      request = hook.result.current.start('LIFESTYLE', 'MONTHLY');
    });
    const signal = state.post.mock.calls[0][2].signal as AbortSignal;
    state.user = { ...readyUser, userId: 'another-account' };
    hook.rerender();
    expect(signal.aborted).toBe(true);
    await act(async () => {
      complete({ data: { data: { mode: 'TEST', checkoutUrl: 'https://checkout.paymongo.com/old-account' } } });
      await request;
    });
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.pendingTier).toBeNull();
  });
  it('ignores malformed, old and unsupported pending selections', () => {
    for (const value of [
      'broken',
      JSON.stringify({ tier: 'HEALTH', period: 'YEARLY', savedAt: 0 }),
      JSON.stringify({ tier: 'FREE', period: 'MONTHLY', savedAt: Date.now() }),
    ]) {
      sessionStorage.setItem(checkoutSelectionKey, value);
      expect(pendingMembershipSelection()).toBeNull();
    }
  });
  it('preserves legacy card padding while compound pricing cards control their own padding', () => {
    const view = render(
      <Card>
        <p>Legacy content</p>
      </Card>
    );
    expect(screen.getByText('Legacy content').parentElement).toHaveClass('px-6', 'py-5');
    view.rerender(
      <Card>
        <CardHeader>Plan</CardHeader>
        <CardContent>Features</CardContent>
      </Card>
    );
    expect(screen.getByText('Features').parentElement).not.toHaveClass('px-6', 'py-5');
  });
});

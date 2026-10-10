import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './LandingHome';

const state = vi.hoisted(() => ({
  replace: vi.fn(),
  isLoading: false,
  profileLoadError: false,
  user: null as null | {
    role: 'USER';
    emailVerified: boolean;
    onboardingDone: boolean;
    tosAccepted: boolean;
    reportAcknowledged?: boolean;
    onboardingNextPath?: string;
  },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: state.replace }) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: state.user,
    isLoading: state.isLoading,
    profileLoadError: state.profileLoadError,
    logout: vi.fn(),
    refreshSession: vi.fn(),
  }),
}));
vi.mock('@/components/shared/PublicHeader', () => ({ default: () => <header>Public navigation</header> }));
vi.mock('motion/react', () => ({
  useReducedMotion: () => false,
  MotionConfig: ({ children }: { children: React.ReactNode }) => children,
  motion: new Proxy({}, { get: (_target, tag: string) => tag }),
  useMotionValue: (init = 0) => ({ get: () => init, set: vi.fn() }),
  animate: vi.fn(() => ({ stop: vi.fn() })),
  useScroll: () => ({ scrollYProgress: { get: () => 0 } }),
  useTransform: (_value: unknown, _input: unknown, output: unknown) => (Array.isArray(output) ? output[0] : 0),
}));

describe('public home navigation', () => {
  beforeEach(() => {
    state.replace.mockClear();
    state.isLoading = false;
    state.profileLoadError = false;
    state.user = null;
  });

  it('lets an unverified account return home and continue verification from there', () => {
    state.user = { role: 'USER', emailVerified: false, onboardingDone: false, tosAccepted: false };
    render(<Home initialMedia={null} />);

    expect(screen.getByText('Public navigation')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /continue email verification/i })[0]).toHaveAttribute(
      'href',
      '/verify-email'
    );
    expect(state.replace).not.toHaveBeenCalled();
  });

  it('keeps the public home available while an unverified session is loading', () => {
    state.user = { role: 'USER', emailVerified: false, onboardingDone: false, tosAccepted: false };
    state.isLoading = true;
    render(<Home initialMedia={null} />);

    expect(screen.getByText('Public navigation')).toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
  });

  it('still sends a verified account to its workspace', () => {
    state.user = {
      role: 'USER',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      reportAcknowledged: true,
    };
    render(<Home initialMedia={null} />);

    expect(state.replace).toHaveBeenCalledWith('/dashboard');
    expect(screen.queryByText('Public navigation')).not.toBeInTheDocument();
  });
  it('keeps report acknowledgment in the common destination chain', () => {
    state.user = {
      role: 'USER',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      reportAcknowledged: false,
    };
    render(<Home initialMedia={null} />);
    expect(state.replace).toHaveBeenCalledWith('/profile/nutrition-report');
    expect(screen.getByText('Redirecting to your workspace...')).toBeInTheDocument();
  });
  it('offers recovery on the homepage when the provisional profile read fails', () => {
    state.user = { role: 'USER', emailVerified: false, onboardingDone: false, tosAccepted: false };
    state.profileLoadError = true;
    render(<Home initialMedia={null} />);
    expect(screen.getByRole('heading', { name: 'Could not load your account' })).toBeInTheDocument();
    expect(state.replace).not.toHaveBeenCalled();
  });
});

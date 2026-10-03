import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ConditionsPage from '@/app/(onboarding)/onboarding/conditions/page';
import AllergiesPage from '@/app/(onboarding)/onboarding/allergies/page';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refreshSession: vi.fn(),
  search: '',
  entries: [] as Array<{ domain: string; canonicalCode: string | null }>,
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ refreshSession: mocks.refreshSession }) }));
vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ profile: { healthConditions: [], allergies: [] }, isLoading: false }),
}));
vi.mock('@/components/user/StructuredSafetyIntake', () => ({
  default: ({
    onSaved,
    submitLabel,
  }: {
    onSaved: (entries: typeof mocks.entries) => Promise<void>;
    submitLabel: string;
  }) => <button onClick={() => void onSaved(mocks.entries)}>{submitLabel}</button>,
}));

describe('onboarding health details order', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = '';
    mocks.entries = [{ domain: 'CONDITION', canonicalCode: 'HEART_CONDITION' }];
    mocks.refreshSession.mockResolvedValue(undefined);
  });
  it('collects allergies before opening the health-details form', async () => {
    render(<ConditionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue →' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/onboarding/allergies'));
  });
  it('opens the combined form after food safety, including condition-only declarations', async () => {
    render(<AllergiesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue →' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/onboarding/clinical-evidence'));
  });
  it('opens the form for an allergy-only member', async () => {
    mocks.entries = [
      { domain: 'CONDITION', canonicalCode: 'NONE' },
      { domain: 'ALLERGY', canonicalCode: 'NUTS' },
    ];
    render(<AllergiesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue →' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/onboarding/clinical-evidence'));
  });
  it('includes a custom allergy without requiring a predefined code', async () => {
    mocks.entries = [{ domain: 'ALLERGY', canonicalCode: null }];
    render(<AllergiesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue →' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/onboarding/clinical-evidence'));
  });
  it.each(['INTOLERANCE', 'AVOIDED_INGREDIENT'])(
    'opens the existing food restriction form for %s-only declarations',
    async (domain) => {
      mocks.entries = [{ domain, canonicalCode: 'LACTOSE' }];
      render(<AllergiesPage />);
      fireEvent.click(screen.getByRole('button', { name: 'Save and continue →' }));
      await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/onboarding/clinical-evidence'));
    }
  );
  it('skips extra forms when no condition or allergy is declared', async () => {
    mocks.entries = [
      { domain: 'CONDITION', canonicalCode: 'NONE' },
      { domain: 'ALLERGY', canonicalCode: 'NONE' },
    ];
    render(<AllergiesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue →' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/onboarding/shopping-day'));
  });
  it('keeps review edits routed through their required health details and back to review', async () => {
    mocks.search = 'from=review';
    render(<ConditionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Save & Return to Review' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/onboarding/clinical-evidence?from=review'));
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import PreviewConfirmation from './OutsideMealPreview';
import type { OutsideMealModalProps } from './outside-meal-modal.types';

const membership = vi.hoisted(() => ({
  data: null as null | {
    enabled: boolean;
    enhanced: boolean;
    healthAccess: boolean;
    resetsAt: string;
    usage: { OUTSIDE_REVIEW: { used: number; cap: number; remaining: number } };
  },
  isLoading: false,
  error: null as string | null,
  refresh: vi.fn(),
}));
vi.mock('@/features/membership/MembershipProvider', () => ({ useMembership: () => membership }));
const macros = { calories: 400, proteinG: 20, carbsG: 50, fatG: 14 };
const props: OutsideMealModalProps & { warning: NonNullable<OutsideMealModalProps['warning']> } = {
  isLoading: false,
  isOpen: true,
  mealName: 'Reported meal',
  mealType: 'LUNCH',
  notes: '',
  onClose: vi.fn(),
  onMealNameChange: vi.fn(),
  onMealTypeChange: vi.fn(),
  onNotesChange: vi.fn(),
  onSubmit: vi.fn(),
  onWarningCancel: vi.fn(),
  warning: {
    confirmationId: 'preview',
    usedAi: true,
    warnings: [],
    reasons: ['Preparation is unrecorded'],
    estimate: macros,
    items: [
      {
        name: 'Reported food',
        portionGrams: null,
        source: 'GEMINI_ESTIMATED',
        nutritionStatus: 'PENDING_REVIEW',
        includedInTotals: true,
        ...macros,
        calorieLow: 300,
        calorieHigh: 500,
        warnings: [],
      },
    ],
    summary: { provisionalCalories: 400, provisionalItemCount: 1, unresolvedItemCount: 0, completeness: 'COMPLETE' },
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  membership.error = null;
  membership.isLoading = false;
  membership.data = {
    enabled: true,
    enhanced: true,
    healthAccess: true,
    resetsAt: '2026-10-11T16:00:00Z',
    usage: { OUTSIDE_REVIEW: { used: 0, cap: 1, remaining: 1 } },
  };
});
it('saves an estimate separately from requesting one whole-meal review', () => {
  render(<PreviewConfirmation {...props} />);
  fireEvent.click(screen.getByRole('button', { name: 'Save food' }));
  expect(props.onSubmit).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole('button', { name: 'Get RND feedback' }));
  expect(props.onSubmit).toHaveBeenLastCalledWith(true, undefined, true);
  expect(screen.getByText(/1 of 1 feedback requests left/)).toBeInTheDocument();
  expect(screen.getByText(/300–500 kcal/)).toBeInTheDocument();
});
it.each(['quota', 'lifestyle', 'loading', 'error'])(
  'keeps saving available when review is unavailable: %s',
  (state) => {
    if (state === 'quota') membership.data!.usage.OUTSIDE_REVIEW.remaining = 0;
    if (state === 'lifestyle') membership.data!.healthAccess = false;
    if (state === 'loading') membership.isLoading = true;
    if (state === 'error') membership.error = 'Unavailable';
    render(<PreviewConfirmation {...props} />);
    expect(screen.getByRole('button', { name: 'Get RND feedback' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Save food' })).toBeEnabled();
    if (state === 'error') {
      fireEvent.click(screen.getByRole('button', { name: 'Retry allowance' }));
      expect(membership.refresh).toHaveBeenCalledOnce();
    }
  }
);

it('shows Gemini values as an uncited estimate with its range and assumed portion', () => {
  render(<PreviewConfirmation {...props} />);
  expect(screen.getByText('Gemini estimate · no cited source')).toBeVisible();
  expect(screen.getByText(/did not search the web or return source citations/)).toBeVisible();
  expect(screen.getByText(/typical serving was assumed/)).toBeVisible();
  expect(screen.queryByRole('link', { name: /source/i })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Edit food' }));
  expect(props.onWarningCancel).toHaveBeenCalledOnce();
});

it('distinguishes source records, user edits and excluded unknowns in a mixed preview', () => {
  const sources = ['FNRI', 'VERIFIED_LIBRARY', 'USER_REPORTED', 'USER_ADJUSTED_LIBRARY', 'UNRESOLVED'] as const;
  const items = sources.map((source) => ({
    ...props.warning.items[0],
    source,
    name: source,
    portionGrams: 150,
    calorieLow: null,
    calorieHigh: null,
    includedInTotals: source !== 'UNRESOLVED',
  }));
  render(
    <PreviewConfirmation
      {...props}
      warning={{
        ...props.warning,
        usedAi: false,
        items,
        summary: { ...props.warning.summary, unresolvedItemCount: 1, completeness: 'PARTIAL' },
      }}
    />
  );
  expect(screen.getByText('Partial nutrition total')).toBeVisible();
  expect(screen.getByText(/scaled from per-100 g values/)).toBeVisible();
  expect(screen.getByText(/saved library nutrition/)).toBeVisible();
  expect(screen.getByText(/not been independently checked/)).toBeVisible();
  expect(screen.getByText(/do not inherit recipe verification/)).toBeVisible();
  expect(screen.getByText('Not counted')).toBeVisible();
  expect(screen.queryByText(/Gemini did not search/)).not.toBeInTheDocument();
});

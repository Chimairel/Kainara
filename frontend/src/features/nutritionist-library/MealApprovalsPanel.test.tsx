import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MealApprovalsPanel } from './MealApprovalsPanel';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));

describe('meal approvals on the recipe detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ data: { data: [{
      id: 'variant-1', mealName: 'Tinola', nutritionServingDescription: 'One bowl',
      calories: 420, proteinG: 30, carbsG: 20, fatG: 12, ingredients: [],
      approvals: [
        { id: 'a', kind: 'CONDITION', scope: { conditions: ['HYPERTENSION'] }, reviewerName: 'RND A', reviewedAt: '2026-01-01', reviewDueAt: '2027-01-01', status: 'ACTIVE', flagReason: null },
        { id: 'b', kind: 'CONDITION', scope: { conditions: ['DIABETES'] }, reviewerName: 'RND B', reviewedAt: '2026-01-01', reviewDueAt: '2027-01-01', status: 'FLAGGED', flagReason: 'Recipe details need checking' },
        { id: 'c', kind: 'CONDITION', scope: { conditions: ['KIDNEY_DISEASE'] }, reviewerName: 'RND C', reviewedAt: '2025-01-01', reviewDueAt: '2026-01-01', status: 'REVIEW_DUE', flagReason: null },
      ],
    }] } });
  });

  it('filters flagged and due approvals independently of other contexts', async () => {
    render(<MealApprovalsPanel mealId="recipe-1" />);
    expect(await screen.findByText('HYPERTENSION · No allergies')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter approvals' }), { target: { value: 'FLAGGED' } });
    expect(screen.getByText('DIABETES · No allergies')).toBeInTheDocument();
    expect(screen.queryByText('HYPERTENSION · No allergies')).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Filter approvals' }), { target: { value: 'REVIEW_DUE' } });
    expect(screen.getByText('KIDNEY_DISEASE · No allergies')).toBeInTheDocument();
    expect(screen.queryByText('DIABETES · No allergies')).not.toBeInTheDocument();
  });
});

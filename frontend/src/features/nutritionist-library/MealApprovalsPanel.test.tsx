import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MealApprovalsPanel } from './MealApprovalsPanel';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));

describe('meal approvals on the recipe detail page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'variant-1',
            mealName: 'Tinola',
            nutritionServingDescription: 'One bowl',
            calories: 420,
            proteinG: 30,
            carbsG: 20,
            fatG: 12,
            ingredients: [],
            approvals: [
              {
                id: 'a',
                kind: 'CONDITION',
                scope: { conditions: ['HYPERTENSION'] },
                reviewerName: 'RND A',
                reviewedAt: '2026-01-01',
                reviewDueAt: '2027-01-01',
                status: 'ACTIVE',
                flagReason: null,
              },
              {
                id: 'b',
                kind: 'CONDITION',
                scope: { conditions: ['DIABETES'] },
                reviewerName: 'RND B',
                reviewedAt: '2026-01-01',
                reviewDueAt: '2027-01-01',
                status: 'FLAGGED',
                flagReason: 'Recipe details need checking',
              },
              {
                id: 'c',
                kind: 'CONDITION',
                scope: { conditions: ['KIDNEY_DISEASE'] },
                reviewerName: 'RND C',
                reviewedAt: '2025-01-01',
                reviewDueAt: '2026-01-01',
                status: 'REVIEW_DUE',
                flagReason: null,
              },
            ],
          },
        ],
      },
    });
  });

  it('filters flagged approvals without displaying a scheduled recheck', async () => {
    render(<MealApprovalsPanel mealId="recipe-1" />);
    expect(await screen.findByText('Hypertension')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('combobox', { name: 'Filter approvals' }));
    fireEvent.click(screen.getByRole('option', { name: 'Flagged' }));
    expect(screen.getByText('Diabetes')).toBeInTheDocument();
    expect(screen.queryByText('Hypertension')).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Scheduled recheck due' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Recheck 1\//)).not.toBeInTheDocument();
  });

  it('opens a combined case and keeps flagging inside the case view', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'variant-1',
            mealName: 'Tinola',
            nutritionServingDescription: 'One bowl',
            calories: 420,
            proteinG: 30,
            carbsG: 20,
            fatG: 12,
            ingredients: [],
            approvals: [
              {
                id: 'condition-1',
                kind: 'CONDITION',
                scope: { conditions: ['DIABETES'] },
                caseScope: { conditions: ['DIABETES'], allergens: ['SHRIMP'] },
                reviewerName: 'RND A',
                reviewedAt: '2026-01-01',
                reviewDueAt: '2027-01-01',
                status: 'ACTIVE',
                flagReason: null,
              },
            ],
          },
        ],
      },
    });
    mocks.get.mockResolvedValueOnce({
      data: {
        data: {
          meal: {
            id: 'variant-1',
            mealName: 'Tinola',
            description: 'Chicken soup',
            calories: 420,
            proteinG: 30,
            carbsG: 20,
            fatG: 12,
            ingredients: [{ ingredientName: 'chicken', quantity: 1, unit: 'cup' }],
          },
          approvalMatchesCurrentRecipe: true,
          recordedScope: { conditions: ['DIABETES'] },
          recordedCaseScope: { conditions: ['DIABETES'], allergens: ['SHRIMP'] },
          linkedUserCurrentProfile: {
            name: 'Test User',
            age: 30,
            sex: 'FEMALE',
            goal: 'MAINTAIN',
            dailyCalorieTarget: 1800,
            dietaryPreference: 'OMNIVORE',
            ricePreference: 'FLEXIBLE',
            conditions: ['DIABETES'],
            allergies: ['SHRIMP'],
          },
          originatingPlan: null,
        },
      },
    });
    render(<MealApprovalsPanel mealId="recipe-1" />);
    expect(await screen.findByText('Diabetes + Shrimp allergy')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Flag approval' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(await screen.findByText(/Test User · 30 years/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Flag approval' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Reason for flagging this approval' }), {
      target: { value: 'The approved serving needs another ingredient check.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit flag' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/nutritionist/library/variant-1/approvals/flag', {
        kind: 'CONDITION',
        approvalId: 'condition-1',
        reason: 'The approved serving needs another ingredient check.',
      })
    );
  });

  it('shows approvals as suspended when the base meal is flagged', async () => {
    mocks.get.mockResolvedValueOnce({
      data: {
        data: [
          {
            id: 'variant-1',
            status: 'FLAGGED',
            mealName: 'Tinola',
            nutritionServingDescription: 'One bowl',
            calories: 420,
            proteinG: 30,
            carbsG: 20,
            fatG: 12,
            ingredients: [],
            approvals: [
              {
                id: 'a',
                kind: 'CONDITION',
                scope: { conditions: ['HYPERTENSION'] },
                reviewerName: 'RND A',
                reviewedAt: '2026-01-01',
                reviewDueAt: '2027-01-01',
                status: 'STALE',
                flagReason: null,
              },
            ],
          },
        ],
      },
    });
    render(<MealApprovalsPanel mealId="recipe-1" />);
    expect(await screen.findAllByText('Suspended by meal-wide flag')).toHaveLength(1);
    expect(screen.getByText('Suspended by meal flag')).toBeInTheDocument();
    expect(screen.getByText('Hypertension')).toBeInTheDocument();
  });
});

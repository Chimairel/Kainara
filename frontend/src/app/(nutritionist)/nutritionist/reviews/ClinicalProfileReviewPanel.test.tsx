import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClinicalProfileReviewPanel from './ClinicalProfileReviewPanel';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));

describe('nutritionist profile document request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockImplementation((path: string) => Promise.resolve({ data: { data: path.endsWith('/profile-reviews')
      ? [{ userId: 'user-1', name: 'Case User', profileRevision: 1, conditions: ['KIDNEY_DISEASE'], allergies: [], needsClarification: false, status: 'PENDING' }]
      : { userId: 'user-1', name: 'Case User', profileRevision: 1, conditions: ['KIDNEY_DISEASE'], allergies: [], needsClarification: false,
        age: 30, goal: 'MAINTAIN', dietaryPreference: 'OMNIVORE', dailyCalorieTarget: 2000, customConditions: [], customFoodRestrictions: [],
        requirements: [{ area: 'KIDNEY_DISEASE', state: 'DOCUMENT_REVIEW_REQUIRED', message: 'Document needed' }], documents: [],
        availableAreas: ['KIDNEY_DISEASE'], previousReview: null, nutritionGuidance: null } } }));
    mocks.post.mockResolvedValue({ data: { success: true } });
  });

  it('allows a document request with a review note while confirmation stays blocked', async () => {
    render(<ClinicalProfileReviewPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Case User/ }));
    expect(await screen.findByText(/Document needed/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Review notes' }), { target: { value: 'Please upload your recent kidney report.' } });
    expect(screen.getByRole('button', { name: 'Confirm for planning' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Request document' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/nutritionist/profile-reviews/user-1/decision', {
      decision: 'REQUEST_DOCUMENT', notes: 'Please upload your recent kidney report.', area: 'KIDNEY_DISEASE',
    }));
  });
});

import { ThemeProvider } from '@/lib/context/ThemeContext';

import type { ComponentProps } from 'react';
import { fireEvent, render as renderUi, screen, within, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CaseReviewDocument from './CaseReviewDocument';
import api from '@/lib/axios';

const render = (ui: Parameters<typeof renderUi>[0]) => renderUi(ui, { wrapper: ThemeProvider });

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'current-rnd' } }) }));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(() => vi.resetAllMocks());

it.each(['MEAL', 'PROFILE'] as const)('sends a %s question from the plus menu and only retires profile handoffs', async purpose => {
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  const model = {
    selectedMealId: 'case', expanded: false, setExpanded: vi.fn(), setSelectedMealId: vi.fn(),
    review: { fetchQueue: vi.fn(), handleSelectMeal: vi.fn(), retireInactiveReview: vi.fn() },
    detailData: {
      mealPlan: { id: 'case', userId: 'member', mealName: 'Recorded meal', mealType: 'LUNCH', scheduledDate: '2026-10-15' },
      user: { name: 'Synthetic member' }, claimStatus: { claimedByMe: true }, warnings: [],
      reviewContext: { contextKey: 'a'.repeat(64), profileRevision: 1, scopeKey: 'scope' },
      clarifications: { enabled: true, forms: [] },
    },
  } as unknown as ComponentProps<typeof CaseReviewDocument>['model'];
  render(<CaseReviewDocument model={model} />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Add page' }));
  expect(screen.getByRole('option', { name: 'Meal question' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Profile question' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('option', { name: purpose === 'MEAL' ? 'Meal question' : 'Profile question' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
  fireEvent.change(screen.getByLabelText('Question 1'), { target: { value: 'Please explain the recorded preparation.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send questions' }));
  await waitFor(() => expect(model.review.fetchQueue).toHaveBeenCalled());
  expect(api.post).toHaveBeenCalledWith('/nutritionist/queue/case/clarifications', expect.objectContaining({ purpose }));
  if (purpose === 'MEAL') {
    expect(model.review.handleSelectMeal).toHaveBeenCalledWith('case');
    expect(model.review.retireInactiveReview).not.toHaveBeenCalled();
  } else expect(model.review.retireInactiveReview).toHaveBeenCalledOnce();
});

vi.mock('./sections/CaseProfileSection', () => ({ default: () => <p>Recorded profile</p> }));
vi.mock('./sections/CaseAuditSection', () => ({ default: () => <p>Recorded meal evidence</p> }));
vi.mock('./sections/CaseDecisionSection', () => ({ default: () => <p>Decision controls</p>, CaseDecisionPage: () => <p>Decision page</p> }));
vi.mock('./useReviewSwap', () => ({ useReviewSwap: () => ({}) }));

it('shows a claimed-case release failure inside the fullscreen canvas', () => {
  const error = 'Could not release this meal. Refresh the queue and try again.';
  const model = {
    selectedMealId: 'synthetic-case',
    expanded: true,
    setExpanded: vi.fn(),
    setSelectedMealId: vi.fn(),
    claimHeader: <button>Release claim</button>,
    errorMsg: error,
    review: { fetchQueue: vi.fn(), handleSelectMeal: vi.fn(), retireInactiveReview: vi.fn() },
    detailData: {
      mealPlan: { id: 'synthetic-case', mealName: 'Synthetic plate', mealType: 'LUNCH', scheduledDate: '2026-10-10' },
      user: { name: 'Synthetic member' },
      claimStatus: { claimedByMe: true },
      warnings: [],
    },
  } as unknown as ComponentProps<typeof CaseReviewDocument>['model'];
  render(<CaseReviewDocument model={model} />);
  const canvas = screen.getByRole('dialog', { name: /Case approval.*fullscreen/ });
  expect(within(canvas).getByRole('alert')).toHaveTextContent(error);
  expect(within(canvas).getByRole('button', { name: 'Release claim' })).toBeVisible();
});

it('keeps claim errors visible inside the preview canvas', () => {
  const model = {
    selectedMealId: 'synthetic-case',
    expanded: false,
    setExpanded: vi.fn(),
    setSelectedMealId: vi.fn(),
    claimHeader: <button>Claim review</button>,
    errorMsg: 'This case is being reviewed by another RND.',
    review: { fetchQueue: vi.fn(), handleSelectMeal: vi.fn(), retireInactiveReview: vi.fn() },
    detailData: {
      mealPlan: { id: 'synthetic-case', mealName: 'Synthetic plate', mealType: 'LUNCH', scheduledDate: '2026-10-10' },
      user: { name: 'Synthetic member' },
      claimStatus: { claimedByMe: false },
      warnings: [],
    },
  } as unknown as ComponentProps<typeof CaseReviewDocument>['model'];
  render(<CaseReviewDocument model={model} />);
  const canvas = screen.getByRole('region', { name: 'RND review canvas' });
  expect(within(canvas).getByRole('alert')).toHaveTextContent('This case is being reviewed by another RND.');
  expect(within(canvas).getByRole('combobox', { name: 'Add page' })).toBeDisabled();
  expect(within(canvas).getByRole('combobox', { name: 'Move tool (V)' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Back to queue' }));
  expect(model.setSelectedMealId).toHaveBeenCalledWith(null);
});

it('opens references on demand as a canvas sheet and retains the selected evidence in fullscreen', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: {
    rows: [{ id: 'review-1', mealName: 'Heart meal', decision: 'APPROVE', reviewerName: 'Original RND',
      reviewedAt: '2026-10-13T10:00:00Z', plateFacts: null, ingredients: [] }], total: 1, totalPages: 1,
  } } });
  const model = {
    selectedMealId: 'synthetic-case', expanded: false, setExpanded: vi.fn(), setSelectedMealId: vi.fn(),
    claimHeader: <button>Claim review</button>,
    review: { fetchQueue: vi.fn(), handleSelectMeal: vi.fn(), retireInactiveReview: vi.fn() },
    detailData: {
      mealPlan: { id: 'synthetic-case', mealName: 'Synthetic plate', mealType: 'LUNCH', scheduledDate: '2026-10-10' },
      user: { name: 'Synthetic member', conditions: ['HEART_CONDITION'] },
      claimStatus: { claimedByMe: true }, warnings: [],
    },
  } as unknown as ComponentProps<typeof CaseReviewDocument>['model'];
  const { rerender } = render(<CaseReviewDocument model={model} />);
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByRole('article', { name: 'Related condition reviews' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: 'Add page' }));
  fireEvent.click(screen.getByRole('option', { name: 'Related reviews' }));
  await screen.findByText('Original RND');
  const paper = screen.getByRole('article', { name: 'Related condition reviews' });
  expect(paper.closest('[data-canvas-world]')).not.toBeNull();
  expect(paper).toHaveAttribute('data-document-page', '3');
  expect(paper.closest('[data-canvas-sheet]')).toHaveClass('outline');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(within(paper).getByRole('button', { name: 'View evidence for Heart meal' }));
  fireEvent.change(within(paper).getByLabelText('Search reviewed meals'), { target: { value: 'Heart' } });
  fireEvent.click(within(paper).getByRole('button', { name: 'View evidence for Heart meal' }));
  rerender(<CaseReviewDocument model={{ ...model, expanded: true }} />);
  const canvas = screen.getByRole('dialog', { name: /Case approval.*fullscreen/ });
  expect(within(canvas).getByLabelText('Search reviewed meals')).toHaveValue('Heart');
  await within(canvas).findByRole('button', { name: 'Hide evidence for Heart meal' });
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  fireEvent.click(within(canvas).getByRole('combobox', { name: 'Add page' }));
  fireEvent.click(screen.getByRole('option', { name: 'Related reviews' }));
  expect(screen.getAllByRole('article', { name: 'Related condition reviews' })).toHaveLength(1);
  rerender(<CaseReviewDocument model={{ ...model, selectedMealId: 'another-case', detailData: {
    ...model.detailData!, mealPlan: { ...model.detailData!.mealPlan, id: 'another-case' },
  } }} />);
  expect(screen.queryByRole('article', { name: 'Related condition reviews' })).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Add page' })).toBeInTheDocument();
});

it('keeps published questions as information sheets and opens the blank composer from Canvas tools only', () => {
  const model = {
    selectedMealId: 'case', expanded: false, setExpanded: vi.fn(), setSelectedMealId: vi.fn(),
    claimHeader: <button>Claim review</button>,
    review: { fetchQueue: vi.fn(), handleSelectMeal: vi.fn(), retireInactiveReview: vi.fn() },
    detailData: {
      mealPlan: { id: 'case', userId: 'member', mealName: 'Recorded meal', mealType: 'LUNCH', scheduledDate: '2026-10-14' },
      user: { name: 'Recorded member' }, claimStatus: { claimedByMe: false }, warnings: [],
      reviewContext: { contextKey: 'version', profileRevision: 1, scopeKey: 'scope' },
      clarifications: { enabled: true, forms: [{ id: 'form', title: 'Saved questions', authorName: 'Original RND',
        profileRevision: 1, scopeKey: 'scope', status: 'ANSWERED',
        questions: [{ id: 'q', label: 'Recorded question', type: 'TEXT', required: true }],
        responses: [{ id: 'response', version: 1, answers: { q: 'Recorded answer' }, submittedAt: '2026-10-14' }], resolution: null,
      }] },
    },
  } as unknown as ComponentProps<typeof CaseReviewDocument>['model'];
  render(<CaseReviewDocument model={model} />);
  expect(screen.queryByRole('article', { name: 'Request profile clarification' })).not.toBeInTheDocument();
  const paper = screen.getByRole('article', { name: 'Saved questions' });
  expect(paper).toHaveAttribute('data-document-page', '3');
  expect(within(paper).getByLabelText('Recorded question *')).toHaveValue('Recorded answer');
  expect(within(paper).getByLabelText('Recorded question *')).toBeDisabled();
  expect(screen.queryByLabelText('Resolution notes')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Form title')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Add page' })).toBeDisabled();
  expect(screen.getByRole('combobox', { name: 'Move tool (V)' })).toBeEnabled();
  expect(screen.queryByLabelText('Form title')).not.toBeInTheDocument();
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import MealQuestions from './MealQuestions';
import api from '@/lib/axios';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import type { ClarificationWorkspace } from './types';

const navigation = vi.hoisted(() => ({ questionId: '' }));
vi.mock('next/navigation', () => ({ useSearchParams: () => ({ get: () => navigation.questionId }) }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/components/ui/Modal', () => ({ default: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
  isOpen ? <div role="dialog">{children}</div> : null }));
const workspace: ClarificationWorkspace = { enabled: true, forms: [{
  id: 'meal-form', purpose: 'MEAL', title: 'Lunch portion', authorName: 'Recorded RND', createdAt: '2026-10-15',
  profileRevision: 2, scopeKey: 'scope', status: 'AWAITING_MEMBER', resolution: null, responses: [],
  questions: [{ id: 'portion', type: 'TEXT', label: 'How much did you serve?', required: true }],
}] };
beforeEach(() => { clearSessionResourceCache(); vi.resetAllMocks(); navigation.questionId = ''; });
afterEach(() => clearSessionResourceCache());

it('opens a notification question and submits the answer without deciding a meal or changing a profile', async () => {
  navigation.questionId = 'meal-form';
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: workspace } });
  vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
  render(<MealQuestions ownerId="member-one" />);
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('How much did you serve? *'), { target: { value: 'One small bowl.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledOnce());
  expect(api.post).toHaveBeenCalledWith('/user/clinical-clarifications/meal-form/answers', expect.objectContaining({
    answers: { portion: 'One small bowl.' }, expectedResponseId: null, profileRevision: 2, scopeKey: 'scope',
  }));
  expect(await screen.findByText(/this has not approved or rejected the meal/)).toBeInTheDocument();
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
});

it('does not display a previous member’s delayed answer workspace after account change', async () => {
  let finish!: (value: unknown) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  vi.mocked(api.get).mockResolvedValue({ data: { success: true, data: { enabled: true, forms: [] } } });
  const view = render(<MealQuestions ownerId="member-one" />);
  view.rerender(<MealQuestions ownerId="member-two" />);
  await act(async () => { finish({ data: { success: true, data: workspace } }); });
  expect(screen.queryByRole('button', { name: /RND meal questions/ })).not.toBeInTheDocument();
  expect(screen.queryByText('Lunch portion')).not.toBeInTheDocument();
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import RndClarifications from './RndClarifications';
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));
const workspace = { enabled: true, forms: [] };
const target = { url: '/nutritionist/queue/meal/clarifications', expectedContextKey: 'a'.repeat(64) };
const prepare = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
  fireEvent.change(screen.getByLabelText('Question 1'), { target: { value: 'Please clarify the reported diagnosis.' } });
};
describe('meal canvas clarification composer', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(api.post).mockResolvedValue({ data: { data: { id: 'form' } } }); });
  it('requires a meal claim and sends the opened context to the meal endpoint without profile changes', async () => {
    const updated = vi.fn().mockResolvedValue(undefined);
    const view = render(<RndClarifications userId="member" profileRevision={3} scopeKey="scope" workspace={workspace} canWrite={false} onUpdated={updated} publishTarget={target} />);
    expect(screen.getByRole('button', { name: 'Add question' })).toBeDisabled();
    expect(screen.getByText('Claim this meal to send questions.')).toBeInTheDocument();
    view.rerender(<RndClarifications userId="member" profileRevision={3} scopeKey="scope" workspace={workspace} canWrite onUpdated={updated} publishTarget={target} />);
    prepare(); fireEvent.click(screen.getByRole('button', { name: 'Send questions' }));
    await waitFor(() => expect(updated).toHaveBeenCalledOnce());
    const [url, body] = vi.mocked(api.post).mock.calls[0];
    expect(url).toBe(target.url);
    expect(body).toMatchObject({ profileRevision: 3, scopeKey: 'scope', expectedContextKey: target.expectedContextKey, questions: [{ type: 'TEXT', label: 'Please clarify the reported diagnosis.', required: true }] });
    expect(body).not.toHaveProperty('conditions');
    expect(body).not.toHaveProperty('authorUserId');
  });
  it('preserves questions and the retry identity when a transient send fails', async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error('Temporary failure'));
    render(<RndClarifications userId="member" profileRevision={3} scopeKey="scope" workspace={workspace} canWrite onUpdated={vi.fn().mockResolvedValue(undefined)} publishTarget={target} />);
    prepare(); fireEvent.click(screen.getByRole('button', { name: 'Send questions' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Question 1')).toHaveValue('Please clarify the reported diagnosis.');
    fireEvent.click(screen.getByRole('button', { name: 'Send questions' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(vi.mocked(api.post).mock.calls[1][1]);
  });
  it('hands stale failures to the canvas owner and never resolves forms from the meal workspace', async () => {
    const failure = { response: { data: { code: 'MEAL_REVIEW_CONTEXT_CHANGED' } } };
    const invalidated = vi.fn().mockReturnValue(true);
    vi.mocked(api.post).mockRejectedValue(failure);
    render(<RndClarifications userId="member" profileRevision={3} scopeKey="scope" workspace={{ enabled: true, forms: [{ id: 'form', title: 'Saved question', authorName: 'RND', createdAt: '2026-10-10', profileRevision: 3, scopeKey: 'scope', questions: [{ id: 'q', type: 'TEXT', label: 'Recorded question', required: true }], responses: [{ id: 'response', version: 1, answers: { q: 'Recorded answer' }, submittedAt: '2026-10-10' }], resolution: null, status: 'ANSWERED', sourceMeal: { id: 'meal', mealName: 'Saved plate', scheduledDate: '2026-10-10' } }] }} canWrite onUpdated={vi.fn()} publishTarget={target} onInvalidated={invalidated} />);
    expect(screen.queryByLabelText('Resolution notes')).toBeNull();
    expect(screen.getByText(/Requested during meal review: Saved plate/)).toBeInTheDocument();
    expect(screen.getByLabelText('Recorded question *')).toBeDisabled();
    prepare(); fireEvent.click(screen.getByRole('button', { name: 'Send questions' }));
    await waitFor(() => expect(invalidated).toHaveBeenCalledWith(failure));
  });
});

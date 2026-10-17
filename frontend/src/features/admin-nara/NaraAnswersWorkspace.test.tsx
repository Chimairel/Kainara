import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import NaraAnswersWorkspace from './NaraAnswersWorkspace';

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
const draft = {
  question: 'Why does KAINARA need my weekly weight?',
  variants: ['Bakit kailangan ang timbang sa KAINARA?'],
  answer: 'Keep your planning information current.',
  category: 'APP_HELP',
};
const entry = { id: 'nara-answer-test', revision: 1, draft, published: null, publishedAt: null };
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.get).mockResolvedValue({ data: { data: [] } });
});

it('saves a draft before publishing and previews exact alternative wording without AI', async () => {
  vi.mocked(api.post)
    .mockResolvedValueOnce({ data: { data: entry } })
    .mockResolvedValueOnce({ data: { data: { ...entry, revision: 2, published: draft } } });
  render(<NaraAnswersWorkspace />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'New answer' })).toBeEnabled());
  expect(screen.getByRole('button', { name: 'Publish answer' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Question'), { target: { value: draft.question } });
  fireEvent.change(screen.getByLabelText(/Alternative questions/), { target: { value: draft.variants[0] } });
  fireEvent.change(screen.getByLabelText('Instant answer'), { target: { value: draft.answer } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText('Draft saved. Publish it when the answer is ready.');
  expect(api.post).toHaveBeenCalledWith('/admin/nara-answers', draft);
  fireEvent.change(screen.getByLabelText('Test question'), { target: { value: draft.variants[0].toUpperCase() } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview answer' }));
  expect(screen.getAllByText(draft.answer).some((element) => element.getAttribute('role') === 'status')).toBe(true);
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Publish answer' }));
  await screen.findByText(/Published. Nara can now/);
  expect(api.post).toHaveBeenLastCalledWith('/admin/nara-answers/nara-answer-test/publish', { revision: 1 });
});

it('retains edits and shows a stale-revision error without overwriting another session', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: [entry] } });
  vi.mocked(api.patch).mockRejectedValue({
    response: { data: { error: 'This answer changed in another session. Reload before saving.' } },
  });
  render(<NaraAnswersWorkspace />);
  fireEvent.click(await screen.findByRole('button', { name: draft.question }));
  fireEvent.change(screen.getByLabelText('Instant answer'), { target: { value: 'My unsaved revision' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByRole('alert');
  expect(screen.getByLabelText('Instant answer')).toHaveValue('My unsaved revision');
  expect(screen.getByRole('button', { name: 'Publish answer' })).toBeDisabled();
});

it('keeps published content active while editing and lets an admin unpublish it', async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { data: [{ ...entry, published: draft }] } });
  vi.mocked(api.post).mockResolvedValue({ data: { data: { ...entry, revision: 2 } } });
  render(<NaraAnswersWorkspace />);
  fireEvent.click(await screen.findByRole('button', { name: draft.question }));
  fireEvent.click(screen.getByRole('button', { name: 'Unpublish' }));
  await screen.findByText('Unpublished. The draft is kept for editing.');
  expect(api.post).toHaveBeenCalledWith('/admin/nara-answers/nara-answer-test/unpublish', { revision: 1 });
});

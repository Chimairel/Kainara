import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import React from 'react';
import AdminMealBatch from './AdminMealBatch';
const mocks = vi.hoisted(() => ({ post: vi.fn(), get: vi.fn(), refetch: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'admin' } }) }));
vi.mock('@/hooks/useSessionQuery', () => ({
  useSessionQuery: () => ({ data: { meals: [], total: 0 }, refetch: mocks.refetch }),
}));
vi.mock('next/image', () => ({
  default: (
    props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean; unoptimized?: boolean }
  ) =>
    React.createElement('img', {
      ...Object.fromEntries(
        Object.entries(props).filter(([key]) => !['fill', 'priority', 'unoptimized'].includes(key))
      ),
      alt: props.alt ?? '',
    }),
}));
const input = {
  format: 'KAINARA_MEALS_V1',
  meals: [
    {
      mealName: 'Chicken test',
      mealType: 'LUNCH',
      calories: 320,
      image: {
        url: 'https://res.cloudinary.com/test/image/upload/chicken.jpg',
        altText: 'A chicken and rice test meal',
        imageKind: 'REPRESENTATIVE',
      },
    },
  ],
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockResolvedValue({ data: { data: input } });
  mocks.post.mockResolvedValue({
    data: {
      data: {
        previewId: 'p1',
        valid: true,
        alreadyImported: false,
        results: [{ index: 0, mealName: 'Chicken test', errors: [] }],
      },
    },
  });
});
it('edits and formats JSON, shows its linked image and invalidates stale validation', async () => {
  render(<AdminMealBatch active />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Recipe JSON' }), { target: { value: JSON.stringify(input) } });
  expect(screen.getByRole('img', { name: 'A chicken and rice test meal' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Preview and validate' }));
  await screen.findByText('Ready to import as unverified drafts');
  expect(mocks.post).toHaveBeenCalledWith('/admin/meals/batch/preview', input);
  expect(screen.getByRole('button', { name: 'Import all as drafts' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: 'Format JSON' }));
  expect(screen.queryByRole('button', { name: 'Import all as drafts' })).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue(JSON.stringify(input, null, 2));
});
it('keeps malformed JSON editable and does not submit it to the server', async () => {
  render(<AdminMealBatch active />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '{ nope' } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview and validate' }));
  await screen.findByText(/Invalid JSON/);
  expect(mocks.post).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox')).toHaveValue('{ nope');
  expect(screen.getByText('Finish the JSON to see your meals')).toBeInTheDocument();
});
it('imports once with the preview identity, blocks duplicate clicks and retains recovery after failure', async () => {
  render(<AdminMealBatch active />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: JSON.stringify(input) } });
  fireEvent.click(screen.getByRole('button', { name: 'Preview and validate' }));
  await screen.findByText('Ready to import as unverified drafts');
  let finish!: (value: unknown) => void;
  mocks.post.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Import all as drafts' }));
  fireEvent.click(screen.getByRole('button', { name: 'Import all as drafts' }));
  expect(mocks.post.mock.calls.filter((c) => c[0].endsWith('/import'))).toEqual([
    ['/admin/meals/batch/import', { previewId: 'p1' }],
  ]);
  await act(async () => finish({ data: { data: { meals: [{ id: 'draft' }], replayed: false } } }));
  await screen.findByText('1 unverified drafts imported. RND review is required before member use.');
  expect(screen.getByRole('button', { name: 'Import all as drafts' })).toBeDisabled();
});
it('inserts the backend template and ignores an earlier file read after an edit', async () => {
  render(<AdminMealBatch active />);
  fireEvent.click(screen.getByRole('button', { name: 'Insert template' }));
  await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(JSON.stringify(input, null, 2)));
  let finish!: (text: string) => void;
  const file = new File(['old'], 'old.json');
  Object.defineProperty(file, 'text', {
    value: () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  });
  fireEvent.change(screen.getByLabelText('Upload meal JSON'), { target: { files: [file] } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"current":true}' } });
  await act(async () => finish('{"old":true}'));
  expect(screen.getByRole('textbox')).toHaveValue('{"current":true}');
});

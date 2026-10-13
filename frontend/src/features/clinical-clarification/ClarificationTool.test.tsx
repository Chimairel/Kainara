import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import api from '@/lib/axios';
import ClarificationTool from './ClarificationTool';
import { useRndClarificationDraft } from './RndClarifications';
vi.mock('@/lib/axios', () => ({ default: { post: vi.fn() } }));
const updated = vi.fn();
function Fixture({ revision = 1 }: { revision?: number }) {
  const draft = useRndClarificationDraft(`member:${revision}`);
  return <ClarificationTool userId="member" profileRevision={revision} scopeKey={`scope:${revision}`}
    workspace={{ enabled: true, forms: [] }} canWrite draft={draft} onUpdated={updated} showForms={false} />;
}
beforeEach(() => { vi.resetAllMocks(); updated.mockResolvedValue(undefined); });
function prepare() {
  fireEvent.click(screen.getByRole('button', { name: 'Questions' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
  fireEvent.change(screen.getByLabelText('Question 1'), { target: { value: 'Please clarify your treatment.' } });
}
it('retains the draft and retry identity across closing a failed tool, and clears them on a new case revision', async () => {
  vi.mocked(api.post).mockRejectedValueOnce(new Error('Temporary failure')).mockResolvedValue({});
  const { rerender } = render(<Fixture />);
  prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Send questions' }));
  await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Questions' }));
  expect(screen.getByLabelText('Question 1')).toHaveValue('Please clarify your treatment.');
  fireEvent.click(screen.getByRole('button', { name: 'Send questions' }));
  await waitFor(() => expect(updated).toHaveBeenCalledOnce());
  expect(vi.mocked(api.post).mock.calls[0][1]).toEqual(vi.mocked(api.post).mock.calls[1][1]);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  rerender(<Fixture revision={2} />);
  fireEvent.click(screen.getByRole('button', { name: 'Questions' }));
  expect(screen.queryByLabelText('Question 1')).not.toBeInTheDocument();
});
it('keeps the tool open during delivery and prevents a second send', async () => {
  let complete!: (value: unknown) => void;
  vi.mocked(api.post).mockImplementation(() => new Promise(resolve => { complete = resolve; }));
  render(<Fixture />); prepare();
  fireEvent.click(screen.getByRole('button', { name: 'Send questions' }));
  expect(screen.getByRole('button', { name: 'Send questions' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  complete({});
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(api.post).toHaveBeenCalledOnce();
});
it('returns keyboard focus to the toolbar tool after closing', async () => {
  render(<Fixture />);
  const trigger = screen.getByRole('button', { name: 'Questions' });
  trigger.focus();
  fireEvent.click(trigger);
  expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(trigger).toHaveFocus());
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ClarificationFormCard from './ClarificationFormCard';
import type { ClarificationForm } from './types';

const form: ClarificationForm = {
  id: 'form',
  title: 'Clarify your diagnosis',
  profileRevision: 1,
  scopeKey: 'scope',
  createdAt: '2026-10-10',
  authorName: 'Original reviewer',
  status: 'AWAITING_MEMBER',
  responses: [],
  resolution: null,
  questions: [
    { id: 'detail', label: 'What is recorded?', type: 'TEXT', required: true },
    { id: 'choice', label: 'Has it changed?', type: 'CHOICE', options: ['Yes', 'No'], required: true },
  ],
};

describe('shared clarification form', () => {
  it('submits named text and choice answers without altering profile fields', async () => {
    const answer = vi.fn().mockResolvedValue(undefined);
    render(<ClarificationFormCard form={form} mode="member" onAnswer={answer} />);
    fireEvent.change(screen.getByLabelText('What is recorded? *'), { target: { value: 'Recorded detail' } });
    fireEvent.change(screen.getByLabelText('Has it changed? *'), { target: { value: 'No' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith({ detail: 'Recorded detail', choice: 'No' }));
  });
  it('superseded forms are historical and cannot submit answers or resolutions', () => {
    render(<ClarificationFormCard form={{ ...form, status: 'SUPERSEDED' }} mode="member" onAnswer={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Submit answers' })).toBeNull();
    expect(screen.getByLabelText('What is recorded? *')).toBeDisabled();
    expect(screen.getByText(/Historical/)).toBeInTheDocument();
  });
  it('a new claimant can inspect responses but cannot edit the member answers', async () => {
    const resolve = vi.fn().mockResolvedValue(undefined);
    render(
      <ClarificationFormCard
        form={{
          ...form,
          status: 'ANSWERED',
          responses: [
            {
              id: 'response',
              version: 1,
              answers: { detail: 'Recorded detail', choice: 'No' },
              submittedAt: '2026-10-10',
            },
          ],
        }}
        mode="reviewer"
        onResolve={resolve}
      />
    );
    expect(screen.getByLabelText('What is recorded? *')).toBeDisabled();
    expect(screen.getByLabelText('What is recorded? *')).toHaveValue('Recorded detail');
    fireEvent.change(screen.getByLabelText('Resolution notes'), {
      target: { value: 'Reviewed the recorded response.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resolve clarification' }));
    await waitFor(() => expect(resolve).toHaveBeenCalledWith('Reviewed the recorded response.'));
  });
  it('claim loss disables resolution and keeps all prior response versions visible', () => {
    render(
      <ClarificationFormCard
        form={{
          ...form,
          status: 'ANSWERED',
          responses: [
            { id: 'r1', version: 1, answers: { detail: 'Original answer' }, submittedAt: '2026-10-10' },
            { id: 'r2', version: 2, answers: { detail: 'Corrected answer' }, submittedAt: '2026-10-10' },
          ],
        }}
        mode="reviewer"
        disabled
        onResolve={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Resolve clarification' })).toBeDisabled();
    expect(screen.getByText('Original answer', { exact: false })).toBeInTheDocument();
    expect(screen.getByLabelText('What is recorded? *')).toHaveValue('Corrected answer');
  });
});

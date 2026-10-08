import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ExpertiseEditor from './ExpertiseEditor';
import type { NutritionistRow } from './model';

it('preserves unsaved verification drafts across polling and submits structured evidence', async () => {
  const professional = {
    id: 'rnd',
    verifiedExpertise: [],
    verifiedExperienceYears: null,
  } as unknown as NutritionistRow;
  const onSave = vi.fn().mockResolvedValue(undefined);
  const { rerender } = render(<ExpertiseEditor professional={professional} busy={false} onSave={onSave} />);
  fireEvent.click(screen.getByText('Verify review expertise'));
  fireEvent.click(screen.getByLabelText('Heart health nutrition'));
  fireEvent.change(screen.getByLabelText('Verified years of experience'), { target: { value: '12' } });
  fireEvent.change(screen.getByLabelText('Verification evidence or revocation reason'), {
    target: { value: 'Verified employment reference.' },
  });
  rerender(<ExpertiseEditor professional={{ ...professional, verifiedExpertise: [] }} busy={false} onSave={onSave} />);
  expect(screen.getByLabelText('Heart health nutrition')).toBeChecked();
  expect(screen.getByLabelText('Verified years of experience')).toHaveValue(12);
  fireEvent.click(screen.getByRole('button', { name: 'Save verified expertise' }));
  await waitFor(() =>
    expect(onSave).toHaveBeenCalledWith({
      conditions: ['HEART_CONDITION'],
      experienceYears: 12,
      evidence: 'Verified employment reference.',
    })
  );
});

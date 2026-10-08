import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { ThemeProvider } from '@/lib/context/ThemeContext';
import CaseReviewContext from './CaseReviewContext';
import type { ReviewContext } from './CaseReviewDocument';

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
const context: ReviewContext = {
  currentProfile: {
    name: 'Synthetic member',
    userProfile: {
      age: 22,
      heightCm: 160,
      weightKg: 57,
      goal: 'BUILD_MUSCLE',
      firstReportAcknowledgedAt: '2026-10-05T20:32:22.051Z',
    },
  },
  reviewedSnapshot: { profile: { age: 21, weightKg: 55 } },
  decisions: [
    {
      id: 'old',
      status: 'APPROVED',
      submittedAt: '2026-10-05T01:00:00Z',
      rationale: 'Original recorded review.',
      evidenceSnapshot: { age: 21, dailyCalorieTarget: 0, sodiumMg: null },
    },
    {
      id: 'new',
      status: 'REJECTED',
      submittedAt: '2026-10-06T01:00:00Z',
      rationale: 'Later recorded concern.',
      evidenceSnapshot: { age: 22, dailyCalorieTarget: 2200 },
    },
  ],
  clinicalEvidence: [{ id: 'doc', documentType: 'LAB_REPORT', originalFileName: 'synthetic.pdf' }],
  historicalInformation: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.get.mockResolvedValue({ data: { success: true, data: context } });
});
async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Open related review details' }));
  await screen.findByRole('combobox', { name: 'Case record' });
}
function select(name: RegExp) {
  fireEvent.click(screen.getByRole('combobox', { name: 'Case record' }));
  fireEvent.click(screen.getByRole('option', { name }));
}
it('uses saved changes, separates the live profile, and retains missing and zero values', async () => {
  render(<CaseReviewContext auditId="case" ownerId="admin" />);
  expect(mocks.get).not.toHaveBeenCalled();
  await open();
  expect(screen.getByText('Later recorded concern.')).toBeVisible();
  select(/^Change 1/);
  const paper = screen.getByRole('article', { name: 'Review change 1' });
  expect(within(paper).getByText('Original recorded review.')).toBeVisible();
  expect(within(paper).getByText('0')).toBeVisible();
  expect(within(paper).getByText('Not recorded')).toBeVisible();
  expect(screen.queryByText('2200')).not.toBeInTheDocument();
  expect(screen.queryByText('Synthetic member')).not.toBeInTheDocument();
  expect(screen.queryByText('old')).not.toBeInTheDocument();
  select(/^Current member profile/);
  expect(screen.getByText('Synthetic member')).toBeVisible();
  expect(screen.getByText('Height (cm)')).toBeVisible();
  expect(screen.getByText('Build muscle')).toBeVisible();
  expect(screen.getByText(/Oct 6, 2026.*Philippine time/)).toBeVisible();
  expect(screen.getByText(/do not replace any historical review snapshot/)).toBeVisible();
  select(/^Profile recorded for review/);
  expect(screen.getByText('55')).toBeVisible();
  expect(screen.queryByText('57')).not.toBeInTheDocument();
});
it('retains selected changes when expanding and returning from full screen', async () => {
  render(
    <ThemeProvider>
      <CaseReviewContext auditId="case" ownerId="admin" />
    </ThemeProvider>
  );
  await open();
  select(/^Change 1/);
  fireEvent.click(screen.getByRole('button', { name: 'Expand case details' }));
  expect(screen.getByRole('dialog', { name: 'Expanded audit report' })).toBeVisible();
  expect(screen.getByText('Original recorded review.')).toBeVisible();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('combobox', { name: 'Case record' })).toHaveTextContent('Change 1');
});
it('rejects malformed responses and discards late reads from another account', async () => {
  let finish!: (value: unknown) => void;
  mocks.get.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  const view = render(<CaseReviewContext auditId="case" ownerId="admin" />);
  fireEvent.click(screen.getByRole('button', { name: 'Open related review details' }));
  view.rerender(<CaseReviewContext auditId="case" ownerId="other" />);
  await act(async () => finish({ data: { success: true, data: context } }));
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  mocks.get.mockResolvedValueOnce({ data: { success: false, data: null } });
  fireEvent.click(screen.getByRole('button', { name: 'Open related review details' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Review context could not be loaded.');
});
it('keeps withdrawn evidence errors visible and requests only the case-scoped document', async () => {
  render(<CaseReviewContext auditId="case/a" ownerId="admin" />);
  await open();
  select(/^Clinical evidence/);
  mocks.get.mockRejectedValueOnce(new Error('Withdrawn'));
  fireEvent.click(screen.getByRole('button', { name: 'Download related lab report' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('It may have been withdrawn.');
  expect(mocks.get).toHaveBeenLastCalledWith('/admin/audit-history/case%2Fa/review-context/documents/doc/file', {
    responseType: 'blob',
  });
});

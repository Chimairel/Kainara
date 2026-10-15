import { ThemeProvider } from '@/lib/context/ThemeContext';
import { fireEvent, render as renderUi, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import SavedApprovalCanvas from './SavedApprovalCanvas';
import { savedReviewPresentation } from './saved-review-presentation';
import api from '@/lib/axios';
import { toast } from 'sonner';

const render = (ui: Parameters<typeof renderUi>[0]) => renderUi(ui, { wrapper: ThemeProvider });

vi.mock('@/lib/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'rnd' } }) }));
vi.mock('./sections/CaseProfileSection', () => ({ default: () => <p>Immutable clinical context</p> }));
vi.mock('./sections/CaseAuditSection', () => ({ default: () => <p>Immutable meal evidence</p> }));
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks(); });

const layout = { version: 1 as const, sheets: [
  { title: 'Member health profile', x: 44, y: 87 }, { title: 'Meal evidence', x: 994, y: 34 },
], view: { x: -213, y: 50, scale: 0.8 }, selected: 1, mode: 'hand' as const };
const snapshot = { savedCanvas: { version: 1, layout, detail: {
  mealPlan: { id: 'plan', mealName: 'Saved meal', mealType: 'LUNCH', scheduledDate: '2026-10-14' },
  user: { name: 'Saved member', conditions: ['HEART_CONDITION'], allergies: [] }, ingredients: [], warnings: [],
} } };
const target = { url: '/nutritionist/case-approvals/decision/flag', expectedVersion: 'a'.repeat(64), canFlag: true, flagged: false };
function fill() {
  fireEvent.change(screen.getByLabelText('Affected ingredients or nutrition fields'), { target: { value: 'salt, sodium' } });
  fireEvent.change(screen.getByLabelText('Explanation'), { target: { value: 'Recorded sodium evidence needs an independent review.' } });
  fireEvent.change(screen.getByLabelText('Supporting evidence or reference'), { target: { value: 'Saved ingredient facts.' } });
  fireEvent.change(screen.getByLabelText('Proposed correction'), { target: { value: 'Check measured sodium amounts.' } });
}

it('replays saved sheet positions and camera; Cancel removes the draft and restores presentation without a request', () => {
  const consoleError = vi.spyOn(console, 'error');
  const { container } = render(<SavedApprovalCanvas snapshot={snapshot} decisionId="decision" approvalFlag={target} />);
  const world = () => container.querySelector('[data-canvas-world]') as HTMLElement;
  expect(world().style.transform).toBe('translate(-213px, 50px) scale(0.8)');
  expect((container.querySelector('[data-canvas-sheet="0"]') as HTMLElement).style.left).toBe('44px');
  expect(screen.getByRole('combobox', { name: 'Hand tool (H)' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Flag approval' }));
  expect(screen.getByRole('article', { name: 'Flag approval reasons' })).toHaveAttribute('data-document-page', '3');
  fill();
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('article', { name: 'Flag approval reasons' })).not.toBeInTheDocument();
  expect(world().style.transform).toBe('translate(-213px, 50px) scale(0.8)');
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Flag approval' }));
  expect(screen.getByLabelText('Explanation')).toHaveValue('');
  expect(consoleError.mock.calls.some(call => String(call[0]).includes('same key'))).toBe(false);
  consoleError.mockRestore();
});

it('retains a rejected draft and submits the linked approval version, with success in Sonner', async () => {
  vi.mocked(api.post).mockRejectedValueOnce({ response: { data: { error: 'Approval changed.' } } })
    .mockResolvedValueOnce({ data: { success: true } });
  render(<SavedApprovalCanvas snapshot={snapshot} decisionId="decision" approvalFlag={target} />);
  fireEvent.click(screen.getByRole('button', { name: 'Flag approval' })); fill();
  fireEvent.click(screen.getByRole('button', { name: 'Submit approval flag' }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Approval changed.'));
  expect(screen.getByLabelText('Explanation')).toHaveValue('Recorded sodium evidence needs an independent review.');
  fireEvent.click(screen.getByRole('button', { name: 'Submit approval flag' }));
  await waitFor(() => expect(toast.success).toHaveBeenCalled());
  expect(api.post).toHaveBeenLastCalledWith(target.url, { expectedVersion: target.expectedVersion, notes: {
    category: 'NUTRITION', affectedFields: ['salt', 'sodium'], explanation: 'Recorded sodium evidence needs an independent review.',
    reference: 'Saved ingredient facts.', proposedCorrection: 'Check measured sodium amounts.',
  } });
  expect(screen.getByRole('button', { name: 'Approval flagged' })).toBeDisabled();
  expect(screen.queryByRole('article', { name: 'Flag approval reasons' })).not.toBeInTheDocument();
});

it('replays related reviews as saved information without fetching current reference results', async () => {
  render(<SavedApprovalCanvas decisionId="decision" snapshot={{ savedCanvas: { ...snapshot.savedCanvas, related: {
    view: { condition: 'HEART_CONDITION', search: 'bread', page: 2, expandedId: null },
    result: { condition: 'HEART_CONDITION', rows: [], total: 24, page: 2, totalPages: 3 },
  } } }} />);
  const page = screen.getByRole('article', { name: 'Related condition reviews' });
  await within(page).findByText(/24 completed reviews/);
  expect(within(page).getByLabelText('Search reviewed meals')).toHaveValue('bread');
  expect(within(page).getByLabelText('Search reviewed meals')).toBeDisabled();
  expect(api.get).not.toHaveBeenCalled();
});

it('labels missing legacy conditions and layout honestly without reading a current profile', () => {
  const result = savedReviewPresentation({ original: { mealName: 'Old meal', ingredients: [] } });
  expect(result.exact).toBe(false); expect(result.layout).toBeNull();
  expect(result.detail.user.conditionsRecorded).toBe(false);
  expect(result.detail.user.allergiesRecorded).toBe(false);
  expect(result.detail.claimStatus.claimedByMe).toBe(false);
  expect(api.get).not.toHaveBeenCalled();
});

it('stacks the same evidence and flag pages at phone widths without scaling form text', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true,
    addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  const { container } = render(<SavedApprovalCanvas snapshot={snapshot} decisionId="decision" approvalFlag={target} />);
  fireEvent.click(screen.getByRole('button', { name: 'Flag approval' }));
  const paper = screen.getByRole('article', { name: 'Flag approval reasons' });
  expect(paper.closest('[data-canvas-world]')).not.toHaveAttribute('style');
  const viewControls = container.querySelector('[aria-label="Canvas view controls"]');
  expect(viewControls).toBeInTheDocument();
  expect(viewControls?.closest('.hidden')).not.toBeNull();
  expect(within(paper).getByLabelText('Explanation')).toHaveClass('text-base');
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.queryByRole('article', { name: 'Flag approval reasons' })).not.toBeInTheDocument();
  vi.unstubAllGlobals();
});

it('shows the immutable flag and resolution on its audit page without changing the original evidence', () => {
  render(<SavedApprovalCanvas snapshot={snapshot} decisionId="decision" recordedConcern={{ id: 'flag', kind: 'CASE',
    mealLibraryId: null, active: false, createdAt: '2026-10-14', notes: { category: 'NUTRITION',
      explanation: 'Original measured sodium concern.', affectedFields: ['sodium'], reference: 'Original source evidence.',
      proposedCorrection: 'Recheck sodium.' }, resolution: 'Independent measured evidence resolves this concern.' }} />);
  const paper = screen.getByRole('article', { name: 'Recorded approval flag' });
  expect(within(paper).getByText('Original measured sodium concern.')).toBeInTheDocument();
  expect(within(paper).getByText('Independent measured evidence resolves this concern.')).toBeInTheDocument();
  expect(within(paper).queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByText('Immutable clinical context')).toBeInTheDocument();
});

it('replays a recorded rationale paper at the approver’s saved position without editable decision controls', () => {
 const rationale = 'Recorded exact-serving review rationale for this synthetic decision.';
 const saved = { ...snapshot, reviewRationale:rationale, savedCanvas:{...snapshot.savedCanvas, layout:{...layout,sheets:[...layout.sheets,{title:'Approval rationale',x:1800,y:120}]}} };
 render(<SavedApprovalCanvas snapshot={saved} decisionId="reason-decision" approvalFlag={target}/>);
 const paper=screen.getByRole('article',{name:'Approval rationale'});
 expect(paper.closest('[data-canvas-sheet]')).toHaveStyle({left:'1800px',top:'120px'});
 expect(within(paper).getByLabelText('Review rationale')).toHaveValue(rationale);
 expect(within(paper).getByLabelText('Review rationale')).toHaveAttribute('readonly');
 expect(screen.queryByRole('button',{name:'Confirm approval'})).not.toBeInTheDocument();
});

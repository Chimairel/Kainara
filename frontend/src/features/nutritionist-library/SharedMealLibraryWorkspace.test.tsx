import { ThemeProvider } from '@/lib/context/ThemeContext';
import { fireEvent, render as renderUi, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSessionResourceCache } from '@/lib/session-resource-cache';
import SharedMealLibraryWorkspace from './SharedMealLibraryWorkspace';

const render = (ui: Parameters<typeof renderUi>[0]) => renderUi(ui, { wrapper: ThemeProvider });

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  hook: vi.fn(),
  refresh: vi.fn(),
  loading: vi.fn(() => 'notice'),
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('sonner', () => ({ toast: mocks }));
vi.mock('./RecipeCaseHistory', () => ({ default: ({ role, approvalsOnly }: { role: string; approvalsOnly: boolean }) => <div data-testid="meal-audit">{role} {approvalsOnly ? 'approval audit' : 'case audit'}</div> }));
vi.mock('./useNutritionistLibrary', () => ({ AVAILABLE_CONDITIONS: [], useNutritionistLibrary: mocks.hook }));

const meal = {
  id: 'meal-1',
  mealName: 'Test lunch',
  mealType: 'LUNCH',
  calories: 500,
  proteinG: 30,
  carbsG: 60,
  fatG: 15,
  status: 'APPROVED',
  ingredients: [],
  usageCount: 0,
  flags: [],
  baseVerification: 'VERIFIED',
};
let claimed = true;
let review = {
  state: 'PUBLISHED',
  recipeVersion: 'a'.repeat(64),
  reviewVersion: 'b'.repeat(64),
  incidentCount: 0,
  legacyHistoryUnknown: false,
  incident: null as null | {
    id: string;
    number: number;
    state: string;
    reports: unknown[];
    decisions: unknown[];
    claimedByNutritionistId: null;
  },
  history: [] as unknown[],
  validConfirmations: [] as unknown[],
  canAdminRelease: false,
};
function held(state = 'PENDING_REREVIEW') {
  review = {
    ...review,
    state,
    incidentCount: state === 'QUARANTINED' ? 2 : 1,
    incident: {
      id: 'case-1',
      number: 1,
      state,
      claimedByNutritionistId: null,
      decisions: [],
      reports: [
        {
          id: 'report-1',
          createdAt: '2026-10-08T00:00:00Z',
          actorSnapshot: { name: 'Test admin', role: 'ADMIN' },
          notes: {
            category: 'NUTRITION',
            affectedFields: ['sodiumMg'],
            explanation: 'Ingredient evidence needs independent review.',
            reference: 'Recorded composition evidence.',
            proposedCorrection: 'Check all measured ingredient amounts.',
          },
        },
      ],
    },
  };
}
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'synthetic-library-owner' } }) }));

beforeEach(() => {
  vi.clearAllMocks();
  claimed = true;
  clearSessionResourceCache();
  review = {
    ...review,
    state: 'PUBLISHED',
    incident: null,
    history: [],
    validConfirmations: [],
    canAdminRelease: false,
    incidentCount: 0,
  };
  mocks.hook.mockReturnValue({
    meals: [meal],
    totalCount: 1,
    page: 1,
    setPage: vi.fn(),
    totalPages: 1,
    isLoading: false,
    fetchError: null,
    searchVal: '',
    setSearchVal: vi.fn(),
    mealType: 'All',
    setMealType: vi.fn(),
    conditionTag: 'All',
    setConditionTag: vi.fn(),
    verifiedByMe: false,
    setVerifiedByMe: vi.fn(),
    fetchLibrary: mocks.refresh,
  });
  mocks.get.mockImplementation(async (path: string) => ({
    data: {
      success: true,
      data: path.endsWith('/meal-review-cases')
        ? []
        : path.includes('/meal-review-cases/')
          ? { ...review, claimStatus: { claimedByMe: claimed, claimedByOther: false } }
          : {
              ...meal,
              status: review.state === 'PUBLISHED' ? 'APPROVED' : 'FLAGGED',
              reviewLineage: { state: review.state, incidentCount: review.incidentCount },
            },
    },
  }));
  mocks.post.mockImplementation(async (path: string) => { if (path.endsWith('/claim')) claimed = true; return { data: { success: true } }; });
});

async function open() {
  fireEvent.click(screen.getByRole('button', { name: 'View' }));
  await screen.findByRole('heading', { name: 'Test lunch', level: 1 });
  expect(screen.queryByRole('heading', { name: 'Review reusable recipe evidence' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: /Adapt recipe|Correct held recipe/ })).not.toBeInTheDocument();
}

function fillFlag() {
  if (!screen.queryByRole('dialog')) fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  if (!screen.queryByLabelText('Explanation')) fireEvent.click(screen.getByRole('button', { name: 'Flag meal' }));
  fireEvent.change(screen.getByLabelText('Affected ingredients or nutrition fields'), {
    target: { value: 'sodiumMg, salt' },
  });
  fireEvent.change(screen.getByLabelText('Explanation'), {
    target: { value: 'Ingredient evidence needs independent review.' },
  });
  fireEvent.change(screen.getByLabelText('Supporting evidence or reference'), {
    target: { value: 'Recorded composition evidence.' },
  });
  fireEvent.change(screen.getByLabelText('Proposed correction'), {
    target: { value: 'Check all measured ingredient amounts.' },
  });
}
describe('shared library permissions and feedback', () => {
  for (const role of ['admin', 'nutritionist'] as const) {
    it(`${role} uses the server photo contract in the list and recipe detail`, async () => {
      const image = {
        url: '/meals/contract-photo.jpg',
        altText: 'Stored recipe photograph',
        kind: 'REPRESENTATIVE' as const,
        attribution: {
          creator: 'Recorded photographer',
          sourcePageUrl: null,
          licenseCode: 'OWNED',
          licenseUrl: null,
          modifications: null,
        },
      };
      const workspace = mocks.hook();
      mocks.hook.mockReturnValue({ ...workspace, meals: [{ ...meal, image }] });
      const original = mocks.get.getMockImplementation()!;
      mocks.get.mockImplementation(async (path: string) =>
        path.endsWith('/library/meal-1') ? { data: { success: true, data: { ...meal, image } } } : original(path)
      );
      render(<SharedMealLibraryWorkspace role={role} />);
      expect(screen.getByAltText(image.altText)).toHaveAttribute('src', expect.stringContaining('contract-photo.jpg'));
      await open();
      expect(screen.getByAltText(image.altText)).toHaveAttribute('src', expect.stringContaining('contract-photo.jpg'));
    });
  }
  it('admin flags with version-bound structured notes and sees the recorded actor without RND certification tools', async () => {
    render(<SharedMealLibraryWorkspace role="admin" />);
    expect(mocks.hook).toHaveBeenCalledWith('admin', true);
    await open();
    await screen.findByText('Published');
    expect(screen.queryByText('Private case approvals')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Explanation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('article', { name: 'Base meal verification' })).toBeInTheDocument();
    expect(screen.queryByLabelText('Explanation')).not.toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Flag meal' }));
    expect(screen.getByRole('button', { name: 'Flag and withhold meal' })).toBeDisabled();
    fillFlag();
    mocks.post.mockImplementation(async () => {
      held();
      return { data: { success: true } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold meal' }));
    await screen.findByRole('region', { name: 'Flag concern report-1' });
    expect(mocks.post).toHaveBeenCalledWith('/admin/library/meal-1/flag', {
      expectedVersion: 'a'.repeat(64),
      notes: {
        category: 'NUTRITION',
        affectedFields: ['sodiumMg', 'salt'],
        explanation: 'Ingredient evidence needs independent review.',
        reference: 'Recorded composition evidence.',
        proposedCorrection: 'Check all measured ingredient amounts.',
      },
    });
    expect(screen.queryByRole('button', { name: 'Confirm this version' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Release quarantine' }).at(-1)!).toBeDisabled();
  });
  it('RND review requires every concern resolution and evidence acknowledgement; one RND re-verifies the first incident', async () => {
    held('PENDING_REREVIEW');
    claimed = false;
    render(<SharedMealLibraryWorkspace />);
    await open();
    await screen.findByRole('region', { name: 'Flag concern report-1' });
    const header = (await screen.findByRole('heading', { name: 'Test lunch', level: 1 })).closest('header')!;
    await waitFor(() => expect(within(header).getByText('Pending re-review')).toBeInTheDocument());
    expect(within(header).queryByText('Verified')).not.toBeInTheDocument();
    expect(screen.getByTestId('meal-audit')).toHaveTextContent('nutritionist approval audit');
    expect(screen.getByRole('button', { name: 'Approvals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Meal details' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Meal review' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Re-verify recipe' }).at(-1)!).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Release quarantine' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Claim re-review' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/nutritionist/meal-review-cases/meal-1/claim', {
        expectedVersion: 'b'.repeat(64),
      })
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Resolve concerns' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Resolve concerns' }));
    await screen.findByLabelText('How you resolved this concern');
    fireEvent.change(screen.getByLabelText('How you resolved this concern'), {
      target: { value: 'Resolved by reviewing measured food amounts and recorded evidence.' },
    });
    fireEvent.change(screen.getByLabelText('Independent review findings'), {
      target: { value: 'Independent review covers this exact serving and every concern.' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Re-verify recipe' }).at(-1)!).toBeEnabled());
    fireEvent.click(screen.getAllByRole('button', { name: 'Re-verify recipe' }).at(-1)!);
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        '/nutritionist/meal-review-cases/meal-1/confirm',
        expect.objectContaining({
          expectedVersion: 'b'.repeat(64),
          evidenceReviewed: true,
          riceRoleReviewed: true,
          resolutions: [
            { reportId: 'report-1', rationale: 'Resolved by reviewing measured food amounts and recorded evidence.' },
          ],
        })
      )
    );
  });
  it('admin can decide quarantine with a rationale and no RND confirmations', async () => {
    held('QUARANTINED');
    review.canAdminRelease = true;
    render(<SharedMealLibraryWorkspace role="admin" />);
    await open();
    await screen.findByText(/Only an admin can release/);
    expect(screen.getAllByRole('button', { name: 'Release quarantine' }).at(-1)!).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Resolve concerns' }));
    fireEvent.change(screen.getByLabelText('Administrative rationale'), {
      target: { value: 'Reviewed this current version and all recorded quarantine concerns.' },
    });
    expect(screen.getAllByRole('button', { name: 'Release quarantine' }).at(-1)!).toBeEnabled();
    fireEvent.click(screen.getAllByRole('button', { name: 'Release quarantine' }).at(-1)!);
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith('/admin/meal-review-cases/meal-1/release', {
        expectedVersion: 'b'.repeat(64),
        rationale: 'Reviewed this current version and all recorded quarantine concerns.',
      })
    );
  });
  it('quarantine needs an admin decision and offers no RND confirmation or claim', async () => {
    held('QUARANTINED');
    render(<SharedMealLibraryWorkspace />);
    await open();
    await screen.findByRole('region', { name: 'Flag concern report-1' });
    expect(screen.getByText(/Only an admin can release/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Claim re-review' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-verify recipe' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Release quarantine' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('How you resolved this concern')).not.toBeInTheDocument();
  });
  it('retains comprehensive flag notes when the server rejects a stale version', async () => {
    render(<SharedMealLibraryWorkspace role="admin" />);
    await open();
    await screen.findByText('Published');
    fillFlag();
    mocks.post.mockRejectedValue({
      response: { data: { error: 'Recipe or concerns changed. Refresh and review the current version.' } },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold meal' }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith('Recipe or concerns changed. Refresh and review the current version.'));
    expect(screen.getByLabelText('Explanation')).toHaveValue('Ingredient evidence needs independent review.');
    expect(screen.getByLabelText('Supporting evidence or reference')).toHaveValue('Recorded composition evidence.');
  });

  it('preserves flag, re-verification and quarantine transitions without recipe editors', async () => {
    render(<SharedMealLibraryWorkspace />);
    await open();
    await screen.findByText('Published');
    fillFlag();
    mocks.post.mockImplementation(async () => {
      held();
      return { data: { success: true } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold meal' }));
    const header = (await screen.findByRole('heading', { name: 'Test lunch', level: 1 })).closest('header')!;
    await waitFor(() => expect(within(header).getByText('Pending re-review')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Resolve concerns' }));
    fireEvent.change(screen.getByLabelText('How you resolved this concern'), {
      target: { value: 'All recorded ingredient evidence has been independently checked.' },
    });
    fireEvent.change(screen.getByLabelText('Independent review findings'), {
      target: { value: 'The measured recipe resolves every recorded concern.' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Mark resolved' }));
    mocks.post.mockImplementation(async () => {
      review = { ...review, state: 'PUBLISHED', incident: null };
      return { data: { success: true } };
    });
    fireEvent.click(screen.getAllByRole('button', { name: 'Re-verify recipe' }).at(-1)!);

    await waitFor(() => expect(within(header).getByText('Verified')).toBeInTheDocument());
    mocks.post.mockImplementation(async () => {
      held('QUARANTINED');
      return { data: { success: true } };
    });
    fillFlag();
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold meal' }));
    await waitFor(() => expect(within(header).getByText('Quarantined')).toBeInTheDocument());
    expect(screen.getAllByRole('region', { name: 'Meal-wide review' })).toHaveLength(1);
  });
  it('notifies that a decision was recorded when the later history refresh fails', async () => {
    render(<SharedMealLibraryWorkspace role="admin" />);
    await open();
    await screen.findByText('Published');
    fillFlag();
    mocks.post.mockImplementation(async () => {
      mocks.get.mockRejectedValue(new Error('Network unavailable'));
      return { data: { success: true } };
    });
    fireEvent.click(screen.getByRole('button', { name: 'Flag and withhold meal' }));
    await waitFor(() => expect(mocks.warning).toHaveBeenCalledWith('Decision recorded. Reload the history to see the current review state.'));
    expect(screen.queryByRole('dialog', { name: 'Flag meal' })).not.toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledOnce();
  });
});

for (const role of ['admin', 'nutritionist'] as const) it(`${role} separates Verified and Quarantined without the removed coverage/flagged panel`, async () => {
  render(<SharedMealLibraryWorkspace role={role} />);
  expect(screen.getByRole('button', { name: 'Verified' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: 'Recipe coverage' })).not.toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: 'Flagged recipes' })).not.toBeInTheDocument();
  expect(mocks.get).not.toHaveBeenCalledWith(`/${role}/meal-review-cases`, expect.anything());
  fireEvent.click(screen.getByRole('button', { name: 'Quarantined' }));
  await screen.findByText('No meals are quarantined.');
  expect(mocks.get).toHaveBeenCalledWith(`/${role}/meal-review-cases`, { params: { state: 'QUARANTINED' } });
  expect(screen.getByRole('button', { name: 'Quarantined' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('button', { name: 'View' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Verified' }));
  expect(screen.getByRole('button', { name: 'View' })).toBeVisible();
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClinicalEvidenceWorkspace from './ClinicalEvidenceWorkspace';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  push: vi.fn(),
  search: '',
  owner: 'fixture',
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: mocks.owner } }) }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.search),
}));
const workspace = { safetyRevision: 2, availableAreas: ['HEART_CONDITION'], requirements: [], contexts: [] };
const allergyDetailsLabel = 'Food allergies, intolerances or avoided foods and their reactions';
const clarification = {
  id: 'rnd-question',
  title: 'RND follow-up',
  authorName: 'Recorded reviewer',
  createdAt: '2026-10-10',
  profileRevision: 2,
  scopeKey: 'scope',
  status: 'AWAITING_MEMBER',
  questions: [{ id: 'q', label: 'Please clarify your restriction', type: 'TEXT', required: true }],
  responses: [],
  resolution: null,
};
describe('health details form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.search = '';
    mocks.owner = 'fixture';
    mocks.get.mockResolvedValue({ data: { data: workspace } });
    mocks.put.mockResolvedValue({ data: { data: workspace } });
  });
  it('shows sleeping Nara without form instructions when no health details are needed', async () => {
    mocks.get.mockResolvedValue({ data: { data: { ...workspace, availableAreas: [] } } });
    render(<ClinicalEvidenceWorkspace />);
    expect(
      await screen.findByRole('heading', { name: 'No health details are needed for your current profile' })
    ).toBeInTheDocument();
    expect(screen.getByAltText('Sleeping Nara')).toBeInTheDocument();
    expect(screen.queryByText(/Describe the conditions and restrictions/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save health details' })).not.toBeInTheDocument();
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('does not show the no-details state when the workspace request fails', async () => {
    mocks.get.mockRejectedValue(new Error('Unavailable'));
    render(<ClinicalEvidenceWorkspace />);
    await screen.findByRole('alert');
    expect(screen.queryByAltText('Sleeping Nara')).not.toBeInTheDocument();
  });
  it('shows newly sent RND questions without navigation and preserves unsent health details', async () => {
    render(<ClinicalEvidenceWorkspace />);
    const details = await screen.findByLabelText('Condition or restriction details');
    fireEvent.change(details, { target: { value: 'Unsent member details to preserve' } });
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...workspace,
          contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'Older saved details' } }],
          clarifications: { enabled: true, forms: [clarification] },
        },
      },
    });
    fireEvent(window, new Event(LIVE_UPDATE_EVENT));
    const question = await screen.findByRole('button', { name: /Recorded reviewer, RND.*RND follow-up/ });
    expect(details).toHaveValue('Unsent member details to preserve');
    fireEvent.click(question);
    expect(screen.getByRole('heading', { name: 'RND follow-up' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Your health details.*heart condition/ }));
    expect(screen.getByLabelText('Condition or restriction details')).toHaveValue('Unsent member details to preserve');
    expect(screen.queryByAltText('Sleeping Nara')).not.toBeInTheDocument();
  });
  it('blocks saving an old health draft after an external safety revision changes', async () => {
    render(<ClinicalEvidenceWorkspace />);
    const details = await screen.findByLabelText('Condition or restriction details');
    fireEvent.change(details, { target: { value: 'Unsent member details to preserve' } });
    mocks.get.mockResolvedValue({ data: { data: { ...workspace, safetyRevision: 3 } } });
    fireEvent(window, new Event(LIVE_UPDATE_EVENT));
    await screen.findByRole('button', { name: 'Reload current health details' });
    expect(screen.getByRole('button', { name: 'Save health details' })).toBeDisabled();
    expect(details).toHaveValue('Unsent member details to preserve');
    fireEvent.click(screen.getByRole('button', { name: 'Reload current health details' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save health details' })).toBeEnabled());
    expect(details).toHaveValue('');
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it.each(['AWAITING_MEMBER', 'ANSWERED', 'RESOLVED', 'SUPERSEDED'])(
    'does not show an empty-health illustration beneath a %s RND form',
    async (status) => {
      mocks.get.mockResolvedValue({
        data: {
          data: {
            ...workspace,
            availableAreas: [],
            clarifications: { enabled: true, forms: [{ ...clarification, status }] },
          },
        },
      });
      render(<ClinicalEvidenceWorkspace />);
      await screen.findByRole('region', { name: 'RND clarification forms' });
      expect(screen.queryByAltText('Sleeping Nara')).not.toBeInTheDocument();
      expect(screen.queryByText('No health details are needed for your current profile')).not.toBeInTheDocument();
    }
  );
  it('does not show an empty-health illustration beneath a profile correction', async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...workspace,
          availableAreas: [],
          profileProposals: {
            enabled: true,
            editableInputs: [],
            proposals: [
              {
                id: 'proposal',
                profileRevision: 2,
                scopeKey: 'scope',
                status: 'PENDING',
                authorName: 'Reviewer',
                createdAt: '2026-10-10',
                rationale: 'Recorded proposal',
                beforeSnapshot: { safetyInputs: [], healthDetails: [] },
                changes: { domains: [], healthDetails: [] },
                evidenceSnapshot: [],
                memberNote: null,
                acceptedProfileRevision: null,
              },
            ],
          },
        },
      },
    });
    render(<ClinicalEvidenceWorkspace />);
    await screen.findByRole('region', { name: 'RND profile corrections' });
    expect(screen.queryByAltText('Sleeping Nara')).not.toBeInTheDocument();
  });
  it('shows loading without the empty illustration until the workspace is available', () => {
    mocks.get.mockReturnValue(new Promise(() => {}));
    render(<ClinicalEvidenceWorkspace />);
    expect(screen.getByText('Loading health details…')).toBeInTheDocument();
    expect(screen.queryByAltText('Sleeping Nara')).not.toBeInTheDocument();
  });
  it('shows the separately recorded RND assessment while keeping treatment details editable', async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...workspace,
          availableAreas: ['OTHER'],
          conditionPlanningAssessments: [
            {
              condition: 'Recorded unrelated condition',
              reviewerName: 'Recorded reviewer',
              rationale: 'No additional restrictions after assessing the current treatment.',
            },
          ],
        },
      },
    });
    render(<ClinicalEvidenceWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /RND review.*Condition assessments/ }));
    expect(
      await screen.findByText('Recorded unrelated condition · No additional meal restrictions identified')
    ).toBeInTheDocument();
    expect(screen.getByText(/Reviewed by Recorded reviewer, RND/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Your health details.*other/ }));
    expect(screen.getByLabelText('Current medication or supplements')).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Save health details' })).toBeInTheDocument();
  });
  it('saves structured user-provided details without uploading files', async () => {
    const { container } = render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    await screen.findByLabelText('Condition or restriction details');
    expect(container.querySelector('input[type="file"]')).toBeNull();
    for (const label of [
      'Condition or restriction details',
      'Current medication or supplements',
      'Dietary advice you have received',
      'Recent symptoms or episodes',
    ])
      fireEvent.change(screen.getByLabelText(label), { target: { value: 'Unknown details for review' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save health details' }));
    await waitFor(() =>
      expect(mocks.put).toHaveBeenCalledWith(
        '/user/onboarding/clinical-evidence/details',
        expect.objectContaining({
          area: 'HEART_CONDITION',
          expectedSafetyRevision: 2,
          medications: 'Unknown details for review',
        })
      )
    );
    expect(await screen.findByText(/Health details saved/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to shopping day' }));
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/shopping-day');
  });
  it('shows an RND request and restores saved answers', async () => {
    mocks.get.mockImplementation((path: string) =>
      Promise.resolve({
        data: {
          data: path.endsWith('/status')
            ? { detailsRequest: { area: 'HEART_CONDITION', notes: 'Please describe your current medication.' } }
            : {
                ...workspace,
                contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'Known heart condition' } }],
              },
        },
      })
    );
    render(<ClinicalEvidenceWorkspace />);
    expect(await screen.findByText('Please describe your current medication.')).toBeInTheDocument();
    expect(screen.getByLabelText('Condition or restriction details')).toHaveValue('Known heart condition');
  });
  it('leaves the form available and shows a failed save', async () => {
    mocks.put.mockRejectedValue(new Error('Unavailable'));
    render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    fireEvent.submit((await screen.findByRole('button', { name: 'Save health details' })).closest('form')!);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save health details' })).toBeEnabled();
  });
  it('opens the missing allergy form first and never copies condition answers into it', async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...workspace,
          availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
          requirements: [
            { area: 'HEART_CONDITION', state: 'READY', message: 'Heart details available.' },
            { area: 'FOOD_ALLERGY', state: 'CONTEXT_REQUIRED', message: 'Allergy details needed.' },
          ],
          contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'Saved heart condition details' } }],
        },
      },
    });
    render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    expect(await screen.findByRole('button', { name: 'Allergy details' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('1 of 2 health detail forms complete.')).toBeInTheDocument();
    expect(screen.getByLabelText(allergyDetailsLabel)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Continue to shopping day' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'heart condition' }));
    expect(screen.getByLabelText('Condition or restriction details')).toHaveValue('Saved heart condition details');
    fireEvent.click(screen.getByRole('button', { name: 'Allergy details' }));
    expect(screen.getByLabelText(allergyDetailsLabel)).toHaveValue('');
  });

  it('keeps a requested area selected and shows the remaining form after saving it', async () => {
    const multiple = {
      ...workspace,
      availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
      requirements: ['HEART_CONDITION', 'FOOD_ALLERGY'].map((area) => ({
        area,
        state: 'CONTEXT_REQUIRED',
        message: 'Details needed.',
      })),
    };
    mocks.get.mockImplementation((path: string) =>
      Promise.resolve({
        data: {
          data: path.endsWith('/status')
            ? { detailsRequest: { area: 'HEART_CONDITION', notes: 'Please complete heart details.' } }
            : multiple,
        },
      })
    );
    mocks.put.mockResolvedValue({
      data: {
        data: {
          ...multiple,
          requirements: [{ ...multiple.requirements[0], state: 'READY' }, multiple.requirements[1]],
          contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'Saved heart condition details' } }],
        },
      },
    });
    render(<ClinicalEvidenceWorkspace />);
    expect(await screen.findByRole('button', { name: /Your health details.*heart condition/ })).toHaveAttribute(
      'aria-current',
      'true'
    );
    fireEvent.submit(screen.getByRole('button', { name: 'Save health details' }).closest('form')!);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Your health details.*heart condition.*Details saved/ })
      ).toBeInTheDocument()
    );
    expect(
      screen.getByRole('button', { name: /Your health details.*Allergy details.*Details needed/ })
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Your health details.*Allergy details/ }));
    expect(screen.getByRole('button', { name: /Your health details.*Allergy details/ })).toHaveAttribute(
      'aria-current',
      'true'
    );
    expect(screen.getByLabelText(allergyDetailsLabel)).toHaveValue('');
    expect(mocks.put).toHaveBeenCalledTimes(1);
    expect(mocks.put.mock.calls[0][1]).toMatchObject({ area: 'HEART_CONDITION', expectedSafetyRevision: 2 });
  });
  it('keeps separate unsent drafts for health areas and RND questions', async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...workspace,
          availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
          clarifications: {
            enabled: true,
            forms: [clarification, { ...clarification, id: 'second', title: 'Second question' }],
          },
        },
      },
    });
    render(<ClinicalEvidenceWorkspace />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Please clarify your restriction *' }), {
      target: { value: 'First unsent answer' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Second question.*Response needed/ }));
    expect(screen.getByRole('textbox', { name: 'Please clarify your restriction *' })).toHaveValue('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Please clarify your restriction *' }), {
      target: { value: 'Second unsent answer' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Your health details.*heart condition/ }));
    fireEvent.change(screen.getByLabelText('Condition or restriction details'), { target: { value: 'Heart draft' } });
    fireEvent.click(screen.getByRole('button', { name: /Your health details.*Allergy details/ }));
    expect(screen.getByLabelText(allergyDetailsLabel)).toHaveValue('');
    fireEvent.change(screen.getByLabelText(allergyDetailsLabel), { target: { value: 'Allergy draft' } });
    fireEvent.click(screen.getByRole('button', { name: /Your health details.*heart condition/ }));
    expect(screen.getByLabelText('Condition or restriction details')).toHaveValue('Heart draft');
    fireEvent.click(screen.getByRole('button', { name: /RND follow-up.*Response needed/ }));
    expect(screen.getByRole('textbox', { name: 'Please clarify your restriction *' })).toHaveValue(
      'First unsent answer'
    );
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it('searches and filters historical forms while preserving the open draft', async () => {
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...workspace,
          availableAreas: [],
          clarifications: {
            enabled: true,
            forms: [clarification, { ...clarification, id: 'old', title: 'Previous treatment', status: 'RESOLVED' }],
          },
        },
      },
    });
    render(<ClinicalEvidenceWorkspace />);
    await screen.findByRole('heading', { name: 'RND follow-up' });
    fireEvent.click(screen.getByRole('button', { name: 'History' }));
    expect(screen.queryByRole('button', { name: /RND follow-up.*Response needed/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Previous treatment.*Resolved/ }));
    expect(screen.getByRole('textbox', { name: 'Please clarify your restriction *' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Submit answers' })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search health forms' }), { target: { value: 'no match' } });
    expect(screen.getByText('No forms match your search.')).toBeInTheDocument();
  });
  it('submits only the selected RND form with its saved context and response version', async () => {
    const second = {
      ...clarification,
      id: 'second',
      title: 'Second question',
      profileRevision: 0,
      scopeKey: 'second-scope',
    };
    const current = { ...workspace, clarifications: { enabled: true, forms: [clarification, second] } };
    mocks.get.mockResolvedValue({ data: { data: current } });
    mocks.post.mockImplementation(async () => {
      mocks.get.mockResolvedValue({
        data: {
          data: {
            ...current,
            clarifications: {
              ...current.clarifications,
              forms: [
                clarification,
                {
                  ...second,
                  status: 'ANSWERED',
                  responses: [
                    {
                      id: 'submitted',
                      version: 1,
                      answers: { q: 'Selected answer for the second question' },
                      createdAt: '2026-10-11',
                    },
                  ],
                },
              ],
            },
          },
        },
      });
      return { data: { success: true } };
    });
    render(<ClinicalEvidenceWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: /Second question.*Response needed/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Please clarify your restriction *' }), {
      target: { value: 'Selected answer for the second question' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
    await waitFor(() =>
      expect(mocks.post).toHaveBeenCalledWith(
        '/user/clinical-clarifications/second/answers',
        expect.objectContaining({
          answers: { q: 'Selected answer for the second question' },
          profileRevision: 0,
          scopeKey: 'second-scope',
          expectedResponseId: null,
          requestKey: expect.any(String),
        })
      )
    );
    await screen.findByText(/Answers submitted/);
    fireEvent.click(screen.getByRole('button', { name: /RND follow-up.*Response needed/ }));
    expect(screen.queryByText(/Answers submitted/)).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Please clarify your restriction *' })).toHaveValue('');
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it('clears the previous account’s open form and drafts when the owner changes', async () => {
    const view = render(<ClinicalEvidenceWorkspace />);
    fireEvent.change(await screen.findByLabelText('Condition or restriction details'), {
      target: { value: 'Previous owner private draft' },
    });
    mocks.owner = 'another-member';
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...workspace,
          contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'New owner saved details' } }],
        },
      },
    });
    view.rerender(<ClinicalEvidenceWorkspace />);
    expect(screen.queryByDisplayValue('Previous owner private draft')).not.toBeInTheDocument();
    expect(await screen.findByLabelText('Condition or restriction details')).toHaveValue('New owner saved details');
  });
  it('keeps an RND answer draft but disables submission when the health profile becomes stale', async () => {
    const current = { ...workspace, clarifications: { enabled: true, forms: [clarification] } };
    mocks.get.mockResolvedValue({ data: { data: current } });
    render(<ClinicalEvidenceWorkspace />);
    fireEvent.change(await screen.findByRole('textbox', { name: 'Please clarify your restriction *' }), {
      target: { value: 'Answer for the old profile' },
    });
    mocks.get.mockResolvedValue({ data: { data: { ...current, safetyRevision: 3 } } });
    fireEvent(window, new Event(LIVE_UPDATE_EVENT));
    await screen.findByRole('button', { name: 'Reload current health details' });
    expect(screen.getByRole('button', { name: 'Submit answers' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Please clarify your restriction *' })).toHaveValue(
      'Answer for the old profile'
    );
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('returns completed review edits to the review screen, without changing normal onboarding order', async () => {
    mocks.search = 'from=review';
    render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    const continueButton = await screen.findByRole('button', { name: 'Return to review' });
    expect(continueButton).toBeEnabled();
    expect(screen.getByRole('link', { name: 'Back to review' })).toHaveAttribute('href', '/onboarding/tos');
    fireEvent.click(continueButton);
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/tos');
  });
  it('shows only condition forms and continues to allergies without waiting for allergy details', async () => {
    mocks.search = 'section=conditions';
    mocks.get.mockResolvedValue({
      data: {
        data: {
          ...workspace,
          availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
          requirements: [
            { area: 'HEART_CONDITION', state: 'READY', message: 'Heart details saved.' },
            { area: 'FOOD_ALLERGY', state: 'CONTEXT_REQUIRED', message: 'Allergy details needed.' },
          ],
        },
      },
    });
    render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    expect(await screen.findByRole('heading', { name: 'Condition details' })).toBeInTheDocument();
    await screen.findByRole('button', { name: 'heart condition' });
    expect(screen.queryByRole('button', { name: 'Allergy details' })).not.toBeInTheDocument();
    expect(screen.getByText('1 of 1 health detail forms complete.')).toBeInTheDocument();
    expect(screen.queryByText('Allergy details needed.')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to conditions' })).toHaveAttribute('href', '/onboarding/conditions');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to allergies' }));
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/allergies');
  });

  it('shows only allergy forms and requires their saved details before continuing', async () => {
    mocks.search = 'section=allergies';
    const multiple = {
      ...workspace,
      availableAreas: ['HEART_CONDITION', 'FOOD_ALLERGY'],
      requirements: [
        { area: 'HEART_CONDITION', state: 'CONTEXT_REQUIRED', message: 'Other condition status' },
        { area: 'FOOD_ALLERGY', state: 'CONTEXT_REQUIRED', message: 'Allergy details needed.' },
      ],
      contexts: [{ area: 'HEART_CONDITION', responses: { conditionDetails: 'Saved condition answers' } }],
    };
    mocks.get.mockResolvedValue({ data: { data: multiple } });
    mocks.put.mockResolvedValue({
      data: {
        data: {
          ...multiple,
          requirements: [multiple.requirements[0], { ...multiple.requirements[1], state: 'READY' }],
        },
      },
    });
    render(<ClinicalEvidenceWorkspace mode="onboarding" />);
    await screen.findByRole('button', { name: 'Allergy details' });
    expect(screen.getByRole('heading', { name: 'Allergy details' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'heart condition' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(allergyDetailsLabel)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Continue to shopping day' })).toBeDisabled();
    fireEvent.submit(screen.getByRole('button', { name: 'Save health details' }).closest('form')!);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Continue to shopping day' })).toBeEnabled());
    expect(mocks.put.mock.calls[0][1]).toMatchObject({ area: 'FOOD_ALLERGY', expectedSafetyRevision: 2 });
    fireEvent.click(screen.getByRole('button', { name: 'Continue to shopping day' }));
    expect(mocks.push).toHaveBeenCalledWith('/onboarding/shopping-day');
  });
});

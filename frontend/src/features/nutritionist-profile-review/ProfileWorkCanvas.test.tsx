import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ProfileWorkCanvas from './ProfileWorkCanvas';
import type { useProfileWorkPanelModel } from './useProfileWorkPanelModel';

function Fixture() {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState('');
  const model = {
    expanded,
    setExpanded,
    notes,
    setNotes,
    busy: false,
    profileBlocked: false,
    clearSelection: vi.fn(),
    claimProfile: vi.fn(),
    reloadDetail: vi.fn(),
    decideProfile: vi.fn(),
    conditionAssessments: [],
    setConditionAssessments: vi.fn(),
    requestArea: 'DIABETES',
    setRequestArea: vi.fn(),
    setSelection: vi.fn(),
    setDocumentDetail: vi.fn(),
    setFileUrl: vi.fn(),
    openDocument: vi.fn(),
    selection: null,
    selectedReport: null,
    selectedDocument: null,
    detail: {
      userId: 'member',
      name: 'Synthetic Member',
      currentProfile: {
        revision: 1,
        age: 28,
        goal: 'MAINTAIN',
        dailyCalorieTarget: 2000,
        conditions: ['DIABETES'],
        allergies: [],
      },
      requirements: [],
      reports: [],
      documents: [],
      availableAreas: ['DIABETES'],
      profileReview: {
        profileRevision: 1,
        scopeKey: 'scope',
        needsClarification: false,
        previousReview: null,
        claim: { mine: true, active: true, expiresAt: null },
        healthDetails: [
          {
            area: 'DIABETES',
            responses: {
              conditionDetails: 'Recorded diabetes details',
              medications: 'Unknown',
              dietaryAdvice: 'Unknown',
              recentSymptoms: 'None',
              measurements: '',
            },
          },
        ],
        profileProposals: {
          enabled: true,
          proposals: [],
          editableInputs: [{ domain: 'CONDITION', value: 'DIABETES', provenance: 'PREDEFINED' }],
        },
        clarifications: {
          enabled: true,
          forms: [
            {
              id: 'form',
              title: 'Diabetes questions',
              profileRevision: 1,
              scopeKey: 'scope',
              createdAt: '2026-10-10T00:00:00Z',
              authorName: 'Recorded RND',
              status: 'RESOLVED',
              questions: [{ id: 'q1', type: 'TEXT', label: 'Reported diabetes type', required: true }],
              responses: [
                {
                  id: 'response',
                  version: 1,
                  answers: { q1: 'Reported type 2 diabetes' },
                  submittedAt: '2026-10-10T00:00:00Z',
                },
              ],
              resolution: {
                responseId: 'response',
                rationale: 'Reviewed the reported context.',
                reviewerName: 'Recorded RND',
                resolvedAt: '2026-10-10T00:00:00Z',
              },
            },
          ],
        },
      },
    },
  } as unknown as ReturnType<typeof useProfileWorkPanelModel>;
  return <ProfileWorkCanvas model={model} />;
}

it('gives published forms movable sheets and preserves clarification/correction drafts across fullscreen', async () => {
  render(<Fixture />);
  expect(screen.getByRole('button', { name: 'Move Diabetes questions sheet' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add question' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Question 1' }), {
    target: { value: 'Clarify your recent treatment.' },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Correction rationale' }), {
    target: { value: 'Draft correction rationale.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Expand canvas' }));
  const fullscreen = screen.getByRole('dialog', { name: /Profile review.*fullscreen/ });
  expect(screen.getByRole('textbox', { name: 'Question 1' })).toHaveValue('Clarify your recent treatment.');
  expect(screen.getByRole('textbox', { name: 'Correction rationale' })).toHaveValue('Draft correction rationale.');
  fireEvent.keyDown(fullscreen, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('textbox', { name: 'Question 1' })).toHaveValue('Clarify your recent treatment.');
});
it('keeps profile decision inputs in a separate dialog and retains its notes', async () => {
  render(<Fixture />);
  expect(screen.queryByRole('textbox', { name: 'Review notes' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Profile decision' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Review notes' }), {
    target: { value: 'Recorded decision draft.' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Close' }));
  fireEvent.click(screen.getByRole('button', { name: 'Expand canvas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Profile decision' }));
  expect(screen.getByRole('textbox', { name: 'Review notes' })).toHaveValue('Recorded decision draft.');
});

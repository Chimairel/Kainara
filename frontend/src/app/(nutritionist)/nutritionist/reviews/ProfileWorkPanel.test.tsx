import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileWorkPanel from './ProfileWorkPanel';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: mocks }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'rnd-1' } }) }));
vi.mock('@/lib/session-resource-cache', () => ({ readSessionResource: () => null, writeSessionResource: () => {} }));
vi.mock('@/features/reports/NutritionGuidancePaper', () => ({
  default: ({ profile }: { profile: { goal: string; conditions: string[] } }) =>
    <div data-testid="guidance-paper">{profile.goal} · {profile.conditions.join(', ')}</div>,
}));
vi.mock('@/features/nutritionist-reviews/ExpandableCasePanel', () => ({
  default: ({ children, expanded, onExpandedChange }: { children: React.ReactNode;
    expanded: boolean; onExpandedChange: (value: boolean) => void }) =>
    <div><button onClick={() => onExpandedChange(!expanded)}>{expanded ? 'Back to split view' : 'Expand case details'}</button>{children}</div>,
}));

const people = [
  { userId: 'both', name: 'Both Tasks', conditions: ['DIABETES'], allergies: [],
    profileStatus: 'PENDING', documentCount: 1, documentIds: ['doc-1'] },
  { userId: 'document-only', name: 'Document Only', conditions: [], allergies: [],
    profileStatus: null, documentCount: 1, documentIds: ['doc-2'] },
];
const report = { id: 'report-1', version: 2, generatedAt: '2026-09-28T00:00:00.000Z',
  acknowledgedAt: null, profileRevision: 3, isCurrent: false,
  profileSnapshot: { profile: { goal: 'MAINTAIN', dailyCalorieTarget: 2000 }, conditions: ['DIABETES'], allergens: [] },
  content: { generalSummary: 'Saved guidance', referenceItems: [] } };
const bothDetail = { userId: 'both', name: 'Both Tasks', profileStatus: 'PENDING',
  currentProfile: { revision: 4, age: 30, goal: 'BUILD_MUSCLE', dailyCalorieTarget: 2400,
    conditions: ['DIABETES'], allergies: [] },
  profileReview: { needsClarification: false, previousReview: null, requirements: [], availableAreas: ['DIABETES'] },
  requirements: [], availableAreas: ['DIABETES'], reports: [report],
  documents: [{ id: 'doc-1', area: 'DIABETES', documentType: 'LAB_RESULT', status: 'UPLOADED',
    originalFileName: 'report.png', mimeType: 'image/png', createdAt: '2026-09-28T00:00:00.000Z', pending: true,
    latestReview: null }],
};
const documentOnlyDetail = { ...bothDetail, userId: 'document-only', name: 'Document Only',
  profileStatus: null, profileReview: null, reports: [],
  documents: [{ ...bothDetail.documents[0], id: 'doc-2', originalFileName: 'scan.pdf', mimeType: 'application/pdf' }],
};

describe('unified nutritionist profile work', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn(() => 'blob:test-document'), revokeObjectURL: vi.fn() });
    mocks.get.mockImplementation((path: string) => {
      if (path === '/nutritionist/profile-work') return Promise.resolve({ data: { data: people } });
      if (path === '/nutritionist/profile-work/both') return Promise.resolve({ data: { data: bothDetail } });
      if (path === '/nutritionist/profile-work/document-only') return Promise.resolve({ data: { data: documentOnlyDetail } });
      if (path === '/nutritionist/clinical-evidence/doc-2') return Promise.resolve({ data: { data: {
        id: 'doc-2', area: 'DIABETES', originalFileName: 'scan.pdf', mimeType: 'application/pdf',
        facts: [], user: { contexts: [] },
      } } });
      if (path === '/nutritionist/clinical-evidence/doc-2/file') return Promise.resolve({ data: new Blob(['PDF']) });
      throw new Error(`Unexpected GET ${path}`);
    });
    mocks.patch.mockResolvedValue({ data: { success: true } });
  });

  it('groups profile and document work and keeps a historical report selected after expansion', async () => {
    render(<ProfileWorkPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Both Tasks/ }));
    expect(await screen.findByTestId('guidance-paper')).toHaveTextContent('MAINTAIN · DIABETES');
    expect(screen.getByText(/Current profile revision 4/)).toBeInTheDocument();
    expect(screen.getByText(/Recorded profile:/).parentElement).toHaveTextContent('revision 3');
    expect(mocks.get).not.toHaveBeenCalledWith('/nutritionist/clinical-evidence/doc-1');
    fireEvent.click(screen.getByRole('button', { name: 'Expand case details' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to split view' }));
    expect(screen.getByTestId('guidance-paper')).toHaveTextContent('MAINTAIN · DIABETES');
  });

  it('claims a document-only task before file access and records its decision', async () => {
    render(<ProfileWorkPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Document Only/ }));
    await screen.findByText('No guidance prepared yet.');
    expect(mocks.get).not.toHaveBeenCalledWith('/nutritionist/clinical-evidence/doc-2');
    fireEvent.click(screen.getByRole('button', { name: /scan.pdf/ }));
    expect(await screen.findByTitle('Clinical document scan.pdf')).toBeInTheDocument();
    const urls = mocks.get.mock.calls.map(([path]) => path);
    expect(urls.indexOf('/nutritionist/clinical-evidence/doc-2')).toBeLessThan(urls.indexOf('/nutritionist/clinical-evidence/doc-2/file'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Review rationale' }), { target: { value: 'The image needs clarification.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Record document review' }));
    await waitFor(() => expect(mocks.patch).toHaveBeenCalledWith('/nutritionist/clinical-evidence/doc-2',
      expect.objectContaining({ decision: 'NEEDS_CLARIFICATION', rationale: 'The image needs clarification.' })));
    expect(screen.queryByText('Profile decision')).not.toBeInTheDocument();
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NutritionReportWorkspace from './NutritionReportWorkspace';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), push: vi.fn(), refresh: vi.fn(), update: vi.fn() }));
vi.mock('@/lib/axios', () => ({ default: { get: mocks.get, post: mocks.post } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));
// Return a new user object on every render to detect fetch loops caused by session identity.
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { userId: 'test-user', name: 'Tester' },
    refreshSession: mocks.refresh,
    updateUserSession: mocks.update,
  }),
}));
vi.mock('@/features/reports/ReportHistory', () => ({ default: () => <div>Report archive</div> }));

const report = {
  reportPolicyVersion: 'NUTRITION_GUIDANCE_DETERMINISTIC_V1',
  referenceItems: [
    {
      heading: 'Protein reference',
      value: '50–75 g/day',
      explanation: '10–15% of 2000 kcal ÷ 4 kcal/g.',
      classification: 'CALCULATED_REFERENCE',
      sourceCode: 'DOST_FNRI_PDRI_2015_REV_2018',
      sourceTitle: 'DOST FNRI — PDRI',
      sourceUrl: 'https://fnri.dost.gov.ph/images/images/news/PDRI-2018.pdf',
    },
  ],
  version: 3,
  generatedAt: '2026-09-16T00:00:00Z',
  isStale: false,
  acknowledgedAt: null,
  basedOnConditions: [],
  basedOnAllergies: [],
  generalSummary: 'Current guidance',
  foodsToAvoid: [],
  foodsToLimit: [],
  foodsRecommended: [],
  drinksGuidance: [],
};
const result = (data: unknown) => ({ data: { success: true, data } });

describe('nutrition report lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/profile/nutrition-report');
    mocks.get.mockImplementation(async (path: string) =>
      result(
        path === '/user/profile'
          ? {
              name: 'Tester',
              userProfile: { goal: 'MAINTAIN', dailyCalorieTarget: 2000 },
              healthConditions: [],
              allergies: [],
            }
          : path.endsWith('/history')
            ? []
            : report
      )
    );
    mocks.post.mockImplementation(async (path: string) =>
      result(
        path.endsWith('/acknowledge')
          ? { acknowledgedAt: '2026-10-02T13:00:00Z', version: 3, planningReadiness: null }
          : report
      )
    );
    mocks.refresh.mockResolvedValue({ reportAcknowledged: true });
  });
  it('loads once despite session object changes, acknowledges the displayed version and continues home', async () => {
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and Continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.post).toHaveBeenCalledWith('/user/nutrition-report/acknowledge', { version: 3 });
    expect(mocks.get.mock.calls.filter(([path]) => path === '/user/nutrition-report')).toHaveLength(1);
  });
  it('continues an explicit regeneration request only after acknowledgment succeeds', async () => {
    window.history.replaceState({}, '', '/profile/nutrition-report?next=regenerate');
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and Continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/meals?regenerate=true'));
  });
  it('continues first-time onboarding to the dashboard only after acknowledgment succeeds', async () => {
    window.history.replaceState({}, '', '/nutrition-report?next=dashboard');
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and Continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
  });
  it('does not generate a new report when reading the existing report fails', async () => {
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((path: string) =>
      path === '/user/nutrition-report' ? Promise.reject(new Error('offline')) : get(path)
    );
    render(<NutritionReportWorkspace />);
    await screen.findByText('Report Resolution Failed');
    expect(mocks.post).not.toHaveBeenCalled();
  });
  it('refreshes a stale report before presenting acknowledgment', async () => {
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((path: string) =>
      path === '/user/nutrition-report' ? Promise.resolve(result({ ...report, isStale: true })) : get(path)
    );
    render(<NutritionReportWorkspace />);
    await screen.findByRole('button', { name: 'Acknowledge and Continue' });
    expect(mocks.post).toHaveBeenCalledWith('/user/nutrition-report/generate');
  });
  it('does not navigate if the refreshed session cannot confirm acknowledgment', async () => {
    mocks.refresh.mockResolvedValue(null);
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and Continue' }));
    await screen.findByText(/Unable to confirm the current report status/);
    expect(mocks.push).not.toHaveBeenCalled();
    mocks.refresh.mockResolvedValue({ reportAcknowledged: true });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });
  it('sends only one acknowledgment during repeated clicks and waits for account confirmation', async () => {
    let saved!: (value: unknown) => void;
    mocks.post.mockReturnValue(
      new Promise((resolve) => {
        saved = resolve;
      })
    );
    render(<NutritionReportWorkspace />);
    const button = await screen.findByRole('button', { name: 'Acknowledge and Continue' });
    await act(async () => {
      button.click();
      button.click();
      button.click();
    });
    expect(mocks.post).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
    await act(async () => saved(result({ acknowledgedAt: '2026-10-02T13:00:00Z', version: 3 })));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/dashboard'));
    expect(mocks.refresh).toHaveBeenCalledWith({ showLoader: false });
  });
  it('does not turn a saved acknowledgment into a stale report after an account-check failure', async () => {
    mocks.refresh.mockRejectedValue(new Error('offline'));
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and Continue' }));
    await screen.findByText(/Your acknowledgment was saved. The account check/);
    expect(screen.getByRole('button', { name: 'Continue' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Prepare updated guidance' })).not.toBeInTheDocument();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it('retains the conflict gate when the displayed report really changed', async () => {
    mocks.post.mockRejectedValue({ response: { status: 409, data: { error: 'This guidance changed.' } } });
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and Continue' }));
    await screen.findByRole('button', { name: 'Prepare updated guidance' });
    expect(mocks.refresh).not.toHaveBeenCalled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it('preserves required clinical continuation rather than routing a blocked case home', async () => {
    mocks.post.mockResolvedValue(
      result({
        acknowledgedAt: '2026-10-02T13:00:00Z',
        version: 3,
        planningReadiness: {
          canRequestPlan: false,
          title: 'Review needed',
          message: 'Review needed',
          actionPath: '/profile/clinical-evidence',
        },
      })
    );
    render(<NutritionReportWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'Acknowledge and Continue' }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith('/profile/clinical-evidence'));
  });
  it('explains the evidence layers and consolidates repeated food restrictions', async () => {
    const get = mocks.get.getMockImplementation()!;
    mocks.get.mockImplementation((path: string) => {
      if (path === '/user/profile') {
        return Promise.resolve(
          result({
            name: 'Tester',
            userProfile: { goal: 'MAINTAIN', dailyCalorieTarget: 2000 },
            safetyEntries: [
              { domain: 'ALLERGY', canonicalCode: 'DAIRY' },
              { domain: 'INTOLERANCE', canonicalCode: 'LACTOSE' },
              { domain: 'AVOIDED_INGREDIENT', canonicalCode: 'DAIRY' },
            ],
          })
        );
      }
      if (path === '/user/nutrition-report') {
        return Promise.resolve(result({ ...report, basedOnAllergies: ['DAIRY', 'LACTOSE'] }));
      }
      return get(path);
    });

    render(<NutritionReportWorkspace />);

    expect(await screen.findByRole('heading', { name: 'Nutrition Guidance' })).toBeInTheDocument();
    expect(
      screen.getByText(/Meal eligibility and Registered Nutritionist-Dietitian review are separate checks/i)
    ).toBeInTheDocument();
    expect(screen.getByText('DAIRY, LACTOSE')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DOST FNRI — PDRI' })).toHaveAttribute(
      'href',
      'https://fnri.dost.gov.ph/images/images/news/PDRI-2018.pdf'
    );
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { NutritionReport } from '@/types';
import type { ReportVersion } from './ReportHistory';
import NutritionGuidanceDocument from './NutritionGuidanceDocument';

it('preserves archived snapshots and selected-version downloads without changing planning selection', () => {
  const report = {
    version: 2,
    generatedAt: '2026-10-02T00:00:00Z',
    acknowledgedAt: null,
    generalSummary: 'Latest guidance',
    referenceItems: [],
    reportPolicyVersion: 'NUTRITION_GUIDANCE_DETERMINISTIC_V1',
    planningTargets: {
      calories: 2000,
      proteinG: 120,
      carbsG: 240,
      fatG: 62,
      policyVersion: 'MEAL_MACRO_PLANNING_V1',
      basis: 'MUSCLE_BUILDING_ESTIMATE',
      goal: 'BUILD_MUSCLE',
      explanation: 'Current muscle estimates',
    },
    planningContext: {
      activeVersion: 2,
      activeGeneratedAt: '2026-09-20T00:00:00Z',
      pendingChanges: true,
      safetyChanged: false,
      activationTier: 'LIFESTYLE',
    },
  } as unknown as NutritionReport;
  const download = vi.fn();
  const downloadVersion = vi.fn();
  const useCurrent = vi.fn();
  const setCurrent = vi.fn();
  render(
    <NutritionGuidanceDocument
      report={report}
      name="Tester"
      goal="MAINTAIN"
      dailyCalorieTarget={2000}
      conditions={[]}
      foodRestrictions={[]}
      history={[
        {
          id: 'old',
          version: 1,
          generatedAt: '2026-09-20T00:00:00Z',
          policyVersion: report.reportPolicyVersion,
          acknowledgedAt: '2026-09-21T00:00:00Z',
          content: { ...report, generalSummary: 'Recorded older guidance', planningTargets: null },
          profileSnapshot: {
            profile: { goal: 'LOSE_WEIGHT', dailyCalorieTarget: 1800 },
            conditions: ['HYPERTENSION'],
            allergens: ['EGGS'],
            otherAllergies: 'Sesame intolerance',
          },
        },
      ]}
      error={null}
      isAcknowledging={false}
      onAcknowledge={useCurrent}
      onDownload={download}
      onDownloadVersion={downloadVersion}
      onSetAsCurrent={setCurrent}
    />
  );
  expect(screen.getByRole('region', { name: 'Daily planning estimates' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: 'Report version' }));
  fireEvent.click(screen.getByRole('option', { name: /^Version 1/ }));
  expect(screen.queryByRole('region', { name: 'Daily planning estimates' })).not.toBeInTheDocument();
  expect(screen.getByText('1,800 kcal/day')).toBeInTheDocument();
  expect(screen.queryByText('2,000 kcal/day')).not.toBeInTheDocument();
  expect(screen.getByText('HYPERTENSION')).toBeInTheDocument();
  expect(screen.getByText(/EGGS, Sesame intolerance/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  expect(downloadVersion).toHaveBeenCalledWith(expect.objectContaining({ version: 1, id: 'old' }));
  expect(download).not.toHaveBeenCalled();
  expect(useCurrent).not.toHaveBeenCalled();
  expect(setCurrent).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Set as current' }));
  expect(setCurrent).toHaveBeenCalledWith(expect.objectContaining({ version: 1, id: 'old' }));
  expect(screen.getByText(/selected for planning/i)).toBeInTheDocument();
});

it('does not fill missing archived content or actions from the latest report', () => {
  const acknowledge = vi.fn();
  const download = vi.fn();
  const report = {
    id: 'latest',
    version: 2,
    generatedAt: '2026-10-09T00:00:00Z',
    generalSummary: 'Latest-only summary',
    foodsRecommended: ['Latest-only food'],
    planningTargets: null,
  } as unknown as NutritionReport;
  render(
    <NutritionGuidanceDocument
      report={report}
      name="Member"
      goal="MAINTAIN"
      dailyCalorieTarget={2100}
      conditions={['HEART_CONDITION', 'HEART CONDITION']}
      foodRestrictions={[]}
      error={null}
      isAcknowledging={false}
      onAcknowledge={acknowledge}
      onDownload={download}
      history={[{ id: 'old', version: 1, generatedAt: '2026-09-01T00:00:00Z', content: {} as NutritionReport }]}
    />
  );
  expect(screen.getByText('HEART CONDITION')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('combobox', { name: 'Report version' }));
  fireEvent.click(screen.getByRole('option', { name: /^Version 1/ }));
  expect(screen.queryByText('Latest-only summary')).not.toBeInTheDocument();
  expect(screen.queryByText('Latest-only food')).not.toBeInTheDocument();
  expect(screen.queryByText(/2,571/)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Use this report for meal planning' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Set as current' })).not.toBeInTheDocument();
  expect(acknowledge).not.toHaveBeenCalled();
});

it('refreshes a selected historical version instead of keeping its stale snapshot', () => {
  const report = {
    id: 'latest',
    version: 2,
    generatedAt: '2026-10-09T00:00:00Z',
    generalSummary: 'Latest summary',
    referenceItems: [],
    planningTargets: null,
  } as unknown as NutritionReport;
  const old: ReportVersion = {
    id: 'old',
    version: 1,
    generatedAt: '2026-09-01T00:00:00Z',
    content: { ...report, version: 1, generalSummary: 'Original historical summary' },
  };
  const props = {
    report,
    name: 'Member',
    goal: 'MAINTAIN',
    dailyCalorieTarget: 2100,
    conditions: [],
    foodRestrictions: [],
    error: null,
    isAcknowledging: false,
    onAcknowledge: vi.fn(),
    history: [old],
  };
  const { rerender } = render(<NutritionGuidanceDocument {...props} />);
  fireEvent.click(screen.getByRole('combobox', { name: 'Report version' }));
  fireEvent.click(screen.getByRole('option', { name: /^Version 1/ }));
  expect(screen.getByText('Original historical summary')).toBeInTheDocument();
  rerender(
    <NutritionGuidanceDocument
      {...props}
      history={[
        {
          ...old,
          content: { ...old.content, generalSummary: 'Refreshed recorded summary' },
        },
      ]}
    />
  );
  expect(screen.getByText('Refreshed recorded summary')).toBeInTheDocument();
  expect(screen.queryByText('Original historical summary')).not.toBeInTheDocument();
  expect(screen.queryByText('Latest summary')).not.toBeInTheDocument();
});

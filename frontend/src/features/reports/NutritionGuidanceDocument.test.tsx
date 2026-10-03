import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { NutritionReport } from '@/types';
import NutritionGuidanceDocument from './NutritionGuidanceDocument';

it('uses the archived report snapshot and keeps PDF downloads tied to the latest report', () => {
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
      activeVersion: 1,
      activeGeneratedAt: '2026-09-20T00:00:00Z',
      pendingChanges: true,
      safetyChanged: false,
      activationTier: 'LIFESTYLE',
    },
  } as unknown as NutritionReport;
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
      onAcknowledge={vi.fn()}
      onDownload={vi.fn()}
    />
  );
  expect(screen.getByRole('region', { name: 'Daily planning estimates' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /^Version 1/ }));
  expect(screen.queryByRole('region', { name: 'Daily planning estimates' })).not.toBeInTheDocument();
  expect(screen.getByText('1,800 kcal/day')).toBeInTheDocument();
  expect(screen.queryByText('2,000 kcal/day')).not.toBeInTheDocument();
  expect(screen.getByText('HYPERTENSION')).toBeInTheDocument();
  expect(screen.getByText(/EGGS, Sesame intolerance/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  expect(screen.getByText(/Selected for planning/)).toBeInTheDocument();
});

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
          content: { ...report, generalSummary: 'Recorded older guidance' },
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
  fireEvent.click(screen.getByRole('button', { name: /^Version 1/ }));
  expect(screen.getByText('1,800 kcal/day')).toBeInTheDocument();
  expect(screen.queryByText('2,000 kcal/day')).not.toBeInTheDocument();
  expect(screen.getByText('HYPERTENSION')).toBeInTheDocument();
  expect(screen.getByText(/EGGS, Sesame intolerance/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  expect(screen.getByText(/Selected for planning/)).toBeInTheDocument();
});

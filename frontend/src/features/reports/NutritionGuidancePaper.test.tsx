import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NutritionReport } from '@/types';
import NutritionGuidancePaper, { type GuidanceProfileSnapshot } from './NutritionGuidancePaper';

const profile: GuidanceProfileSnapshot = {
  name: 'Test Member',
  goal: 'MAINTAIN',
  dailyCalorieTarget: 2000,
  conditions: [],
  foodRestrictions: [],
};
const report: NutritionReport = {
  id: 'guidance-fixture',
  userId: 'member-fixture',
  version: 2,
  isStale: false,
  profileRevision: 2,
  generatedAt: '2026-10-10T00:00:00Z',
  acknowledgedAt: null,
  foodsToAvoid: [],
  foodsToLimit: [],
  foodsRecommended: [],
  drinksGuidance: [],
  generalSummary: 'Recorded guidance',
  basedOnConditions: [],
  basedOnAllergies: [],
};

describe('NutritionGuidancePaper version status', () => {
  it('shows newer unacknowledged guidance as awaiting selection while an older version remains active', () => {
    render(
      <NutritionGuidancePaper
        report={{
          ...report,
          planningContext: {
            activeVersion: 1,
            activeGeneratedAt: '2026-10-09T00:00:00Z',
            pendingChanges: true,
            safetyChanged: false,
            activationTier: 'LIFESTYLE',
          },
        }}
        profile={profile}
      />
    );
    expect(screen.getByText(/Not yet selected for planning/)).toBeInTheDocument();
    expect(screen.queryByText(/Archived record/)).not.toBeInTheDocument();
  });

  it('labels older guidance as archived and previously selected when a newer version is active', () => {
    render(
      <NutritionGuidancePaper
        report={{ ...report, version: 1, acknowledgedAt: '2026-10-09T00:00:00Z' }}
        profile={profile}
        activePlanningVersion={2}
      />
    );
    expect(screen.getByText(/Previously selected for planning/)).toBeInTheDocument();
    expect(screen.getByText(/Archived record/)).toBeInTheDocument();
  });

  it('shows the acknowledged active version as selected without an archive notice', () => {
    render(
      <NutritionGuidancePaper
        report={{ ...report, acknowledgedAt: '2026-10-10T01:00:00Z' }}
        profile={profile}
        activePlanningVersion={2}
      />
    );
    expect(screen.getByText(/· Selected for planning/)).toBeInTheDocument();
    expect(screen.queryByText(/Archived record/)).not.toBeInTheDocument();
  });

  it('does not archive guidance when no version is selected', () => {
    render(<NutritionGuidancePaper report={report} profile={profile} activePlanningVersion={null} />);
    expect(screen.getByText(/Not yet selected for planning/)).toBeInTheDocument();
    expect(screen.queryByText(/Archived record/)).not.toBeInTheDocument();
  });
});

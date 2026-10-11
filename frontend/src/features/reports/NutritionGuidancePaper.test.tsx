import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { NutritionReport } from '@/types';
import NutritionGuidancePaper, { type GuidanceProfileSnapshot } from './NutritionGuidancePaper';
import { ReviewDocumentPage } from '@/features/nutritionist-reviews/RndQueueDocument';

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

describe('guidance inside a review sheet', () => {
  const extendedReport: NutritionReport = {
    ...report,
    reportPolicyVersion: 'synthetic-test',
    referenceItems: Array.from({ length: 5 }, (_, index) => ({
      heading: `Reference ${index + 1}`,
      value: `${index + 1} g`,
      explanation: `Saved explanation ${index + 1}`,
      classification: 'GENERAL_REFERENCE' as const,
      sourceCode: `synthetic-source-${index + 1}`,
      sourceTitle: `Recorded source ${index + 1}`,
      sourceUrl: `https://example.test/source-${index + 1}`,
    })),
    foodsRecommended: ['Saved recommendation'],
    foodsToLimit: ['Saved limit'],
    foodsToAvoid: ['Saved restriction'],
    drinksGuidance: ['Saved hydration guidance'],
  };

  it('keeps every guidance section and citation on one outer canvas page', () => {
    const { container } = render(
      <ReviewDocumentPage page={2} title="Saved guidance and evidence">
        <NutritionGuidancePaper report={extendedReport} profile={profile} presentation="inline" />
      </ReviewDocumentPage>
    );
    expect(container.querySelectorAll('[data-document-page]')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'Nutrition Guidance', level: 3 })).toBeInTheDocument();
    for (let index = 1; index <= 5; index++) {
      expect(screen.getByText(`Saved explanation ${index}`)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: `Recorded source ${index}` })).toHaveAttribute(
        'href',
        `https://example.test/source-${index}`
      );
    }
    for (const text of ['Saved recommendation', 'Saved limit', 'Saved restriction', 'Saved hydration guidance']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText(/This educational guidance does not replace/)).toBeInTheDocument();
    expect(screen.queryByText(/Continued/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  });

  it('retains the standalone paper pages for member guidance previews', () => {
    const { container } = render(<NutritionGuidancePaper report={extendedReport} profile={profile} />);
    expect(container.querySelectorAll('[data-document-page]')).toHaveLength(2);
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
  });
});

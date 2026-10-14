import { render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CaseEvidenceSheets from './CaseEvidenceSheets';
import type { DetailData } from './review-types';

vi.mock('@/components/user/MealImage', () => ({ default: () => <div>Meal photo</div> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'rnd' } }) }));
vi.mock('@/lib/axios', () => ({ default: { get: vi.fn() } }));

it('shows the saved member guidance and all meal nutrition facts without repeated advisory banners', () => {
  const detail = {
    mealPlan: { id: 'case', mealName: 'Vegetable meal', mealType: 'LUNCH', scheduledDate: '2026-10-15',
      requiresSafetyRevalidation: true, calories: 600, proteinG: 20, carbsG: 80, fatG: 22,
      nutrients: { sodiumMg: 300, sugarG: 0, fiberG: 5, potassiumMg: 600, phosphorusMg: 160, saturatedFatG: 3 } },
    user: { name: 'Synthetic Member', age: 30, sex: 'FEMALE', goal: 'MAINTAIN', dailyCalorieTarget: 2000,
      conditions: [], allergies: [], dietaryPreference: 'OMNIVORE', ricePreference: 'FLEXIBLE',
      nutritionGuidance: { id: 'saved', version: 2, generatedAt: '2026-10-15', acknowledgedAt: '2026-10-15',
        reportPolicyVersion: 'recorded', generalSummary: 'Actual saved member guidance.',
        referenceItems: [{ heading: 'Protein reference', value: '50–75 g/day', explanation: '10–15% of 2000 kcal ÷ 4 kcal/g.',
          sourceTitle: 'Recorded reference', sourceUrl: 'https://example.test/source' }] } },
    ingredients: [], claimStatus: { claimedByMe: false }, highRiskReviewRequired: true,
    clinicalEvidence: { requirements: [{ area: 'HEART_CONDITION', state: 'READY', message: 'Legacy profile summary' }],
      healthDetails: [{ area: 'HEART_CONDITION', responses: { medications: 'Duplicate legacy detail' }, revision: 1 }], documents: [] },
    warnings: [{ severity: 'IMPORTANT', message: 'Generic repeat advisory' }, { severity: 'CRITICAL', message: 'Recorded ingredient conflicts with declared allergy.' }],
  } as unknown as DetailData;
  render(<>{CaseEvidenceSheets({ detailData: detail })}</>);
  expect(screen.getByText('Actual saved member guidance.')).toBeInTheDocument();
  expect(screen.getByText('10–15% of 2000 kcal ÷ 4 kcal/g.')).toBeInTheDocument();
  const facts = screen.getByRole('region', { name: 'Meal nutrition facts' });
  expect(within(facts).getByText('300 mg')).toBeInTheDocument();
  expect(within(facts).getByText('0 g')).toBeInTheDocument();
  expect(within(facts).getByText('Saturated fat')).toBeInTheDocument();
  expect(screen.queryByText(/Profile or evidence changed/)).not.toBeInTheDocument();
  expect(screen.queryByText('Generic repeat advisory')).not.toBeInTheDocument();
  expect(screen.queryByText('Health details reviewed for the profile')).not.toBeInTheDocument();
  expect(screen.queryByText('Duplicate legacy detail')).not.toBeInTheDocument();
  expect(screen.queryByText('Complete structured restrictions')).not.toBeInTheDocument();
  expect(screen.queryByText('Target Goal')).not.toBeInTheDocument();
  expect(screen.getByText('Recorded ingredient conflicts with declared allergy.')).toBeInTheDocument();
});

import './report-canvas-test-setup';
import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { NutritionReport } from '@/types';
import NutritionGuidancePaper from './NutritionGuidancePaper';
import NutritionPdfViewer from './NutritionPdfViewer';

const report = { id: 'saved-report', userId: 'saved-member', version: 3, generatedAt: '2026-10-17T00:00:00Z',
  referenceItems: [], generalSummary: 'Saved planning references need individual meal review.',
  profileSummary: [{label:'Age',value:'24 years'}, {label:'Biological sex',value:'Male'}, {label:'Activity level',value:'Lightly active'}, {label:'Meal times',value:'Not recorded'}],
  calorieCalculation: { inputs: {weightKg:65,heightCm:170,age:24,activityLevel:'LIGHTLY_ACTIVE',goal:'MAINTAIN'}, sexTerm:5,
    rawBmr:1597.5,rawTdee:2196.56,activityMultiplier:1.375,goalAdjustment:0,minimumDailyCalories:500,dailyCalorieTarget:2197,recordedTarget:2197,
    sourceUrl:'https://pubmed.ncbi.nlm.nih.gov/2305711/',sourceTitle:'Resting energy equation'},
  planningTargets: {calories:2197,proteinG:68.65625,fatG:61.0278,carbsG:343.28125,basis:'REVIEW_REFERENCE',explanation:'Planning references, not a prescription.'},
} as unknown as NutritionReport;
const profile = {name:'Current name',goal:'MAINTAIN',dailyCalorieTarget:3000,conditions:[],foodRestrictions:[]};

it('uses saved intake details and the requested explanation/estimate/calculation order', () => {
  render(<NutritionGuidancePaper report={report} profile={profile} />);
  const headings = screen.getAllByRole('heading').map(heading => heading.textContent);
  const expected = ['Your recorded profile','What these numbers mean','Daily planning estimates','How the daily kcal target is calculated','How the macro estimates are calculated'];
  const text = document.body.textContent!;
  let previous = -1;
  for(const heading of expected) { const position = text.indexOf(heading); expect(position).toBeGreaterThan(previous); previous = position; }
  expect(headings).toContain('Your recorded profile');
  expect(screen.getByText('24 years')).toBeInTheDocument();
  expect(screen.getByText('Lightly active')).toBeInTheDocument();
  expect(screen.getByText('Not recorded')).toBeInTheDocument();
  expect(text).not.toMatch(/No AI|without an AI call|Calculated by KAINARA/);
  const calculation = screen.getByRole('region',{name:'Macro calculations'});
  expect(calculation.textContent).toMatch(/Protein:.*4 kcal\/g.*Fat:.*9 kcal\/g.*Carbohydrate:.*4 kcal\/g/s);
});

it('removes the report paper selection highlight while keeping canvas zoom controls', () => {
  const {container} = render(<NutritionPdfViewer report={report} profile={profile} selectedVersion={null} currentVersion={3}
    isAcknowledged={false} isAcknowledging={false} onAcknowledge={vi.fn()} expanded={false} onExpandedChange={vi.fn()} />);
  expect(container.querySelector('.outline-brand-accent')).toBeNull();
  expect(screen.getByRole('button',{name:'Zoom in'})).toBeInTheDocument();
});

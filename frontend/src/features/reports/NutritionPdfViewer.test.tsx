import './report-canvas-test-setup';
import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import NutritionPdfViewer from './NutritionPdfViewer';
import type { NutritionReport } from '@/types';

it('uses the RND canvas and contains modified-wheel zoom within the report', () => {
  render(
    <>
      <p data-testid="outside">Home navigation stays outside</p>
      <NutritionPdfViewer
        report={
          {
            id: 'report',
            version: 1,
            generalSummary: 'Recorded guidance',
            generatedAt: '2026-10-17T00:00:00Z',
            referenceItems: [],
          } as unknown as NutritionReport
        }
        profile={{ name: 'Member', goal: 'MAINTAIN', dailyCalorieTarget: 2000, conditions: [], foodRestrictions: [] }}
        selectedVersion={null}
        currentVersion={1}
        isAcknowledged={false}
        isAcknowledging={false}
        onAcknowledge={vi.fn()}
        expanded={false}
        onExpandedChange={vi.fn()}
      />
    </>
  );
  expect(screen.getByRole('region', { name: 'Nutrition report canvas' })).toBeInTheDocument();
  const inside = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -60 });
  fireEvent(screen.getByRole('region', { name: 'Review canvas viewport' }), inside);
  expect(inside.defaultPrevented).toBe(true);
  const outside = new WheelEvent('wheel', { bubbles: true, cancelable: true, ctrlKey: true, deltaY: -60 });
  fireEvent(screen.getByTestId('outside'), outside);
  expect(outside.defaultPrevented).toBe(false);
  expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Review decisions' })).not.toBeInTheDocument();
});

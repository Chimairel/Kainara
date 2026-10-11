import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DataWorkspaceOverview from './DataWorkspaceOverview';
import type { DataRelease, WorkspaceSummary } from './types';

const summary: WorkspaceSummary = {
  foodItems: 15072,
  foodAliases: 81,
  mealLibrary: 2027,
  completeMealLibrary: 0,
  consumptionStats: 2620,
  dataSources: 1,
  activeReleases: 1,
  priceSources: 0,
  pricePublications: 0,
  priceObservations: 0,
};
const release: DataRelease = {
  id: 'release',
  sourceId: 'source',
  versionLabel: 'nutrients-v1',
  sourceUrl: 'https://example.test/source',
  retrievedAt: '2026-10-10T12:00:00Z',
  status: 'ACTIVE',
  source: {
    code: 'FNRI',
    name: 'FNRI nutrient evidence',
    domain: 'FOOD_COMPOSITION',
    isEnabled: true,
    updateCadence: 'Per recorded source release',
  },
  createdByAdmin: { name: 'Admin' },
  mappings: {},
  _count: { consumptionStats: 0, activations: 1 },
};
function show(releases: DataRelease[] = [release]) {
  const navigate = vi.fn();
  render(
    <DataWorkspaceOverview summary={summary} releases={releases} releaseCount={releases.length} onNavigate={navigate} />
  );
  return navigate;
}
describe('current nutrition data overview', () => {
  it('shows nutrient evidence and clinical completeness without obsolete consumption totals', () => {
    show();
    expect(screen.getByText('15,072')).toBeVisible();
    expect(screen.getByText('0 / 2,027')).toBeVisible();
    expect(screen.queryByText('Consumption rows')).not.toBeInTheDocument();
    expect(screen.queryByText('2,620')).not.toBeInTheDocument();
    expect(screen.queryByText(/publishing workflow/i)).not.toBeInTheDocument();
    expect(screen.getByText(/RNDs remain the only role/)).toBeVisible();
  });
  it('opens the existing FNRI/USDA catalogues and release metadata', () => {
    const navigate = show();
    fireEvent.click(screen.getByRole('button', { name: 'FNRI catalogue' }));
    expect(navigate).toHaveBeenLastCalledWith('catalogue');
    fireEvent.click(screen.getByRole('button', { name: 'USDA catalogue' }));
    expect(navigate).toHaveBeenLastCalledWith('usda-catalogue');
    fireEvent.click(screen.getByRole('button', { name: 'View releases' }));
    expect(navigate).toHaveBeenLastCalledWith('sources');
  });
  it('excludes obsolete ENNS even if an old API still reports an active release', () => {
    show([{ ...release, source: { ...release.source, code: 'FNRI_ENNS_IFCS', domain: 'FOOD_CONSUMPTION' } }]);
    expect(screen.queryByText(/FNRI_ENNS_IFCS/)).not.toBeInTheDocument();
    expect(screen.getByText('No active reference-data release is recorded in this workspace.')).toBeVisible();
  });
  it('does not present retired releases or invalid dates as fresh evidence', () => {
    show([
      { ...release, retrievedAt: 'invalid' },
      { ...release, id: 'retired', status: 'RETIRED', versionLabel: 'retired-only' },
    ]);
    expect(screen.getByText('Not recorded')).toBeVisible();
    expect(screen.queryByText(/retired-only|NaN/)).not.toBeInTheDocument();
  });
});

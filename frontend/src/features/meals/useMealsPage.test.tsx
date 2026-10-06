import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useMealsPage } from './useMealsPage';

const fixture = vi.hoisted(() => ({
  params: new URLSearchParams(),
  setSubTab: vi.fn(),
  setSelectedPlanDateKey: vi.fn(),
  initialRequest: vi.fn(),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { userId: 'page-routing-fixture' } }) }));
vi.mock('next/navigation', () => ({ useSearchParams: () => fixture.params }));
vi.mock('@/lib/context/BreadcrumbContext', () => ({
  useBreadcrumb: () => ({ setSubTab: fixture.setSubTab }),
}));
vi.mock('./useMealsWorkspace', () => ({
  useMealsWorkspace: (request: unknown) => {
    fixture.initialRequest(request);
    // Preserve a real controlled tab transition while isolating the separately tested API hook.
    const [activeTab, setActiveTab] = useState('plan');
    return {
      activeTab,
      setActiveTab,
      setSelectedPlanDateKey: fixture.setSelectedPlanDateKey,
      cycles: null,
      awaitingGeneration: { current: 0, upcoming: 0 },
      generationStatus: { current: null, upcoming: null },
      displayedMealCount: 0,
      pendingReview: null,
      isStarterPlan: false,
      nextCycleDay: null,
      error: null,
      historyError: null,
      selectedPlanDay: null,
    };
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, '', '/meals');
  fixture.params = new URLSearchParams();
});

describe('meal page routing after feature extraction', () => {
  it('retains initial library tab, selected date and meal deep link', () => {
    const query = 'tab=library&date=2026-10-06&mealId=fixture-plate';
    fixture.params = new URLSearchParams(query);
    window.history.replaceState(null, '', `/meals?${query}`);
    const { result } = renderHook(() => useMealsPage());
    expect(result.current.activeTab).toBe('library');
    expect(result.current.activeModalMealId).toBe('fixture-plate');
    expect(fixture.initialRequest).toHaveBeenCalledWith({ initialDateKey: '2026-10-06' });
    expect(fixture.setSelectedPlanDateKey).toHaveBeenCalledWith('2026-10-06');
    expect(fixture.setSubTab).toHaveBeenLastCalledWith('library');
    expect(new URL(window.location.href).searchParams.get('mealId')).toBe('fixture-plate');
  });

  it('updates breadcrumb and tab URL while preserving the selected meal and date', () => {
    fixture.params = new URLSearchParams('date=2026-10-06&mealId=fixture-plate');
    window.history.replaceState(null, '', `/meals?${fixture.params}`);
    const { result } = renderHook(() => useMealsPage());
    act(() => result.current.setActiveTab('history'));
    let params = new URL(window.location.href).searchParams;
    expect(params.get('tab')).toBe('history');
    expect(params.get('date')).toBe('2026-10-06');
    expect(params.get('mealId')).toBe('fixture-plate');
    expect(fixture.setSubTab).toHaveBeenLastCalledWith('history');
    act(() => result.current.setActiveTab('plan'));
    params = new URL(window.location.href).searchParams;
    expect(params.has('tab')).toBe(false);
    expect(params.get('date')).toBe('2026-10-06');
    expect(fixture.setSubTab).toHaveBeenLastCalledWith('plan');
  });
});

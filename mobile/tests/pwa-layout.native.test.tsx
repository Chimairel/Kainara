import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import { render } from './render-native';
import { router } from 'expo-router';
import { MemberTabBar } from '../src/ui/member-nav';
import { MealTile } from '../src/ui/meal-tile';
import Home from '../src/app/(member)/(tabs)/index';
import Groceries from '../src/app/(member)/(tabs)/groceries';
import { api } from '../src/lib/client';
import { useResource } from '../src/lib/use-resource';
import { useSession } from '../src/lib/session';
import { manilaDate } from '../src/lib/policies';
import type { Meal } from '../src/lib/contracts';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('../src/lib/client', () => ({ api: { request: jest.fn() } }));
jest.mock('../src/lib/session', () => ({ useSession: jest.fn(), message: (error: unknown) => String(error) }));
jest.mock('../src/lib/use-resource', () => ({ useResource: jest.fn() }));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  SvgXml: 'SvgXml',
  Circle: 'Circle',
  Line: 'Line',
  Polyline: 'Polyline',
  Defs: 'Defs',
  Path: 'Path',
  Rect: 'Rect',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
}));
jest.mock('expo-font', () => ({
  isLoaded: () => true,
  isLoading: () => false,
  loadAsync: jest.fn(async () => {}),
  getLoadedFonts: () => [],
}));
jest.mock('../src/lib/report-pdf', () => ({ shareGroceryPdf: jest.fn() }));
const ready = {
  name: 'Test Member',
  role: 'USER',
  emailVerified: true,
  onboardingDone: true,
  tosAccepted: true,
  reportAcknowledged: true,
  userProfile: { dailyCalorieTarget: 2000 },
};
const session = jest.mocked(useSession);
const resource = jest.mocked(useResource);
const props = {
  state: {
    index: 0,
    routes: [
      { name: 'index', key: 'home' },
      { name: 'meals', key: 'meals' },
      { name: 'groceries', key: 'groceries' },
      { name: 'progress', key: 'progress' },
    ],
  },
} as React.ComponentProps<typeof MemberTabBar>;
beforeEach(() => {
  session.mockReturnValue({ profile: ready, refresh: jest.fn(), signOut: jest.fn() } as unknown as ReturnType<
    typeof useSession
  >);
});

test('the PWA five-item bar opens the profile menu and routes report access', async () => {
  await render(<MemberTabBar {...props} />);
  expect(screen.getAllByRole('tab')).toHaveLength(5);
  await fireEvent.press(screen.getByRole('tab', { name: 'Profile' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Nutrition report' }));
  expect(router.push).toHaveBeenCalledWith('/report');
});
test('a report hold keeps the navigation visible without entering protected screens', async () => {
  session.mockReturnValue({ profile: { ...ready, reportAcknowledged: false } } as unknown as ReturnType<
    typeof useSession
  >);
  await render(<MemberTabBar {...props} />);
  expect(screen.getByRole('tab', { name: 'Meals' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ disabled: true })
  );
  await fireEvent.press(screen.getByRole('tab', { name: 'Meals' }));
  expect(router.navigate).not.toHaveBeenCalled();
});
test('a plan preview and a recipe review never become member meal actions', async () => {
  const meal = {
    id: 'recipe',
    mealName: 'Review fixture',
    mealType: 'LUNCH',
    calories: 400,
    proteinG: 20,
    carbsG: 40,
    fatG: 15,
    verifier: { name: 'Test reviewer', reviewScope: 'RECIPE' },
  } as Meal;
  await render(<MealTile meal={meal} recipe />);
  expect(screen.getByText('Recipe reviewed')).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();
});
test('a read-only grocery projection cannot toggle items', async () => {
  resource.mockReturnValue({
    data: {
      current: {
        groceryList: {
          groceryItems: [{ id: 'ingredient', ingredientName: 'Rice', quantity: 100, unit: 'g', isChecked: false }],
        },
        actionability: { canCheckItems: false },
      },
    },
    loading: false,
    error: null,
    reload: jest.fn(),
  } as unknown as ReturnType<typeof useResource>);
  await render(<Groceries />);
  expect(screen.getByRole('checkbox', { name: 'Rice' })).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ disabled: true })
  );
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Rice' }));
  expect(api.request).not.toHaveBeenCalled();
});
test('the dashboard requires confirmation before its direct eaten action', async () => {
  const meal = {
    id: 'today-meal',
    mealName: 'Today fixture',
    mealType: 'LUNCH',
    status: 'APPROVED',
    scheduledDate: `${manilaDate()}T12:00:00+08:00`,
    calories: 400,
    proteinG: 20,
    carbsG: 40,
    fatG: 15,
  };
  resource.mockImplementation(
    (path) =>
      ({
        data: path === '/user/meals/current' ? [meal] : path?.includes('/water/') ? { totalMl: 0 } : [],
        meta: undefined,
        loading: false,
        error: null,
        reload: jest.fn(),
      }) as unknown as ReturnType<typeof useResource>
  );
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await render(<Home />);
  await fireEvent.press(screen.getByRole('button', { name: 'Mark Today fixture as eaten' }));
  expect(api.request).not.toHaveBeenCalled();
  expect(alert).toHaveBeenCalledWith('Record this meal as eaten?', 'Today fixture', expect.any(Array));
  alert.mockRestore();
});

import { render } from './render-native';
import React from 'react';
import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import Home from '../src/app/(member)/(tabs)/index';
import { MealRow } from '../src/ui/meal-row';
import { DateStrip } from '../src/ui/date-strip';
import { useResource } from '../src/lib/use-resource';
import { api } from '../src/lib/client';
import { manilaDate } from '../src/lib/policies';
import type { Meal } from '../src/lib/contracts';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('../src/lib/client', () => ({ api: { request: jest.fn() } }));
jest.mock('../src/lib/session', () => ({
  useSession: () => ({
    profile: {
      name: 'Test Member',
      role: 'USER',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      reportAcknowledged: true,
      userProfile: { dailyCalorieTarget: 2000 },
    },
    refresh: jest.fn(),
  }),
  message: (error: unknown) => String(error),
}));
jest.mock('../src/lib/use-resource', () => ({ useResource: jest.fn() }));
jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Circle: 'Circle',
  Defs: 'Defs',
  Rect: 'Rect',
  RadialGradient: 'RadialGradient',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
  Path: 'Path',
  SvgXml: 'SvgXml',
}));
jest.mock('expo-font', () => ({
  isLoaded: () => true,
  isLoading: () => false,
  loadAsync: jest.fn(async () => {}),
  getLoadedFonts: () => [],
}));

test('a pending meal stays non-actionable in the restored branded card', async () => {
  await render(
    <MealRow
      meal={
        {
          id: 'pending',
          mealName: 'Pending meal',
          mealType: 'LUNCH',
          calories: 400,
          proteinG: 20,
          carbsG: 50,
          fatG: 10,
        } as Meal
      }
      preview
    />
  );
  expect(screen.getByText('Awaiting review')).toBeOnTheScreen();
  expect(screen.queryByRole('button')).toBeNull();
  expect(router.push).not.toHaveBeenCalled();
});
test('the date selector changes only the selected day', async () => {
  const select = jest.fn();
  await render(<DateStrip dates={['2026-10-24', '2026-10-25']} selected="2026-10-24" onSelect={select} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sun, Oct 25' }));
  expect(select).toHaveBeenCalledWith('2026-10-25');
  expect(api.request).not.toHaveBeenCalled();
});
test('the branded home keeps missing targets explicit and avoids provider requests', async () => {
  const today = manilaDate();
  jest.mocked(useResource).mockImplementation(
    (path) =>
      ({
        data: path?.includes('/water/') ? { totalMl: 0 } : [],
        meta: undefined,
        loading: false,
        error: null,
        reload: jest.fn(),
      }) as ReturnType<typeof useResource>
  );
  await render(<Home />);
  expect(screen.getByLabelText('Protein: 0 grams, target Not recorded')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Add 250 mL of water' })).toBeOnTheScreen();
  expect(jest.mocked(useResource).mock.calls.some(([path]) => path?.includes(today))).toBe(true);
  expect(api.request).not.toHaveBeenCalled();
});

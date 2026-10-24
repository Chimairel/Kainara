import { render } from './render-native';
import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, screen } from '@testing-library/react-native';
import Home from '../src/app/(member)/(tabs)/index';
import LogFood from '../src/app/(member)/log-food';
import { api } from '../src/lib/client';
import { useResource } from '../src/lib/use-resource';

jest.mock('../src/lib/client', () => ({ api: { request: jest.fn() } }));
jest.mock('../src/lib/session', () => ({
  useSession: () => ({
    profile: {
      id: 'member-test',
      name: 'Member',
      role: 'USER',
      emailVerified: true,
      onboardingDone: true,
      tosAccepted: true,
      reportAcknowledged: false,
      nutritionReport: { id: 'report-new', isStale: true },
    },
    refresh: jest.fn(),
  }),
  message: (error: unknown) => (error instanceof Error ? error.message : 'Error'),
}));
jest.mock('../src/lib/use-resource', () => ({
  useResource: jest.fn(() => ({ data: null, loading: false, error: null, reload: jest.fn() })),
}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() }, useLocalSearchParams: () => ({}) }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '00000000-0000-4000-8000-000000000001' }));
jest.mock('react-native-svg', () => ({ SvgXml: 'SvgXml' }));
jest.mock('expo-font', () => ({
  isLoaded: () => true,
  isLoading: () => false,
  loadAsync: jest.fn(async () => {}),
  getLoadedFonts: () => [],
}));
const request = jest.mocked(api.request);

test('a changed profile shows the report hold without requesting plans, intake or water', async () => {
  await render(<Home />);
  expect(screen.getByRole('button', { name: 'Read my nutrition report' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Log food or snack' })).toBeNull();
  expect(jest.mocked(useResource).mock.calls.every(([path]) => path === null)).toBe(true);
  expect(request).not.toHaveBeenCalled();
});

test('outside food is previewed and saved before optional feedback is offered', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const values = { calories: 100, proteinG: 2, carbsG: 20, fatG: 1 };
  const log = {
    id: 'synthetic-log',
    mealName: 'Test labelled food',
    nutritionCompleteness: 'PARTIAL',
    provisionalCalories: 100,
    ...values,
    outsideItems: [{ id: 'synthetic-item', name: 'Test labelled food' }],
  };
  request.mockResolvedValueOnce({
    success: true,
    data: {
      warningRequired: true,
      confirmationId: 'synthetic-preview',
      expiresAt: '2030-01-01T00:00:00Z',
      estimate: values,
      summary: { unresolvedItemCount: 0 },
      items: [{ name: 'Test labelled food', source: 'USER_REPORTED', warnings: [] }],
      warnings: [],
    },
  });
  request.mockResolvedValueOnce({ success: true, data: { warningRequired: false, log } });
  await render(<LogFood />);
  await fireEvent.changeText(screen.getByLabelText('Food or dish name'), 'Test labelled food');
  await fireEvent.press(screen.getByRole('radio', { name: 'Label or menu' }));
  await fireEvent.changeText(screen.getByLabelText('Calories (kcal)'), '100');
  await fireEvent.changeText(screen.getByLabelText('Protein (g)'), '2');
  await fireEvent.changeText(screen.getByLabelText('Carbohydrate (g)'), '20');
  await fireEvent.changeText(screen.getByLabelText('Fat (g)'), '1');
  await fireEvent.press(screen.getByRole('button', { name: 'Preview food log' }));
  await screen.findByRole('button', { name: 'Save food' });
  expect(alert).not.toHaveBeenCalled();
  expect(request.mock.calls[0][2]).toMatchObject({ useAiEstimate: false });
  await fireEvent.press(screen.getByRole('button', { name: 'Save food' }));
  await screen.findByRole('button', { name: 'Request RND feedback' });
  expect(screen.getByText('Nutrition is incomplete. Shown totals may exclude unknown values.')).toBeOnTheScreen();
  expect(screen.getByText('100 kcal remains provisional.')).toBeOnTheScreen();
  expect(request.mock.calls[1][2]).toMatchObject({
    confirmationId: 'synthetic-preview',
    warningAcknowledged: true,
    requestRndReview: false,
    requestKey: '00000000-0000-4000-8000-000000000001',
  });
  expect(alert).toHaveBeenCalledWith('Food logged', expect.any(String), expect.any(Array));
  expect(request).toHaveBeenCalledTimes(2);
  alert.mockRestore();
});

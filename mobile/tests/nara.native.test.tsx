import { render } from './render-native';
import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Nara from '../src/app/(member)/nara';
import { ChatProvider } from '../src/lib/chat-state';
import { api } from '../src/lib/client';
import * as SecureStore from 'expo-secure-store';

jest.mock('../src/lib/client', () => ({ api: { request: jest.fn() } }));
jest.mock('../src/lib/session', () => ({
  useSession: () => ({ profile: { id: 'member-native-test' } }),
  message: (error: unknown) => (error instanceof Error ? error.message : 'Error'),
}));
jest.mock('../src/lib/use-resource', () => ({
  useResource: () => ({
    data: { enabled: true, allowance: { cap: 5, remaining: 5, resetsAt: '2026-11-01T00:00:00Z' } },
    loading: false,
    error: null,
    reload: jest.fn(),
  }),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));
jest.mock('expo-crypto', () => {
  let count = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${String(++count).padStart(12, '0')}` };
});
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-font', () => ({
  isLoaded: () => true,
  isLoading: () => false,
  loadAsync: jest.fn(async () => {}),
  getLoadedFonts: () => [],
}));
const request = jest.mocked(api.request);
const balance = { cap: 5, remaining: 5, resetsAt: '2026-11-01T00:00:00Z' };

test('a PWA quick guide submits its explicit action without AI consent', async () => {
  request.mockResolvedValue({
    success: true,
    data: {
      confirmationRequired: false,
      allowance: balance,
      reply: { text: 'Guide response', source: 'SYSTEM', creditsUsed: 0 },
    },
  });
  await mount();
  await fireEvent.press(screen.getByRole('button', { name: 'Find a meal' }));
  await waitFor(() =>
    expect(request).toHaveBeenCalledWith(
      '/user/assistant/messages',
      'POST',
      expect.objectContaining({ action: 'FIND_MEAL', message: 'Find a meal', allowAi: false })
    )
  );
});

async function mount() {
  await render(
    <ChatProvider>
      <Nara />
    </ChatProvider>
  );
}
test('selecting the AI command never submits the bare command', async () => {
  await mount();
  await fireEvent.changeText(screen.getByLabelText('Your question to Nara'), '/ai');
  await fireEvent.press(screen.getByRole('button', { name: '/ai — Ask AI · 1 credit after confirmation' }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
  expect(screen.getByLabelText('AI mode selected')).toBeOnTheScreen();
});
test('Escape never makes a bare command submit as a chat message', async () => {
  await mount();
  const input = screen.getByLabelText('Your question to Nara');
  await fireEvent.changeText(input, '/ai');
  await fireEvent(input, 'keyPress', { nativeEvent: { key: 'Escape' }, preventDefault: jest.fn() });
  await fireEvent.press(screen.getByRole('button', { name: 'Send question' }));
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByLabelText('AI mode selected')).toBeOnTheScreen();
});
test('Enter selects Ask AI without submitting', async () => {
  await mount();
  const input = screen.getByLabelText('Your question to Nara');
  await fireEvent.changeText(input, '/ai');
  await fireEvent(input, 'keyPress', { nativeEvent: { key: 'Enter' }, preventDefault: jest.fn() });
  expect(request).not.toHaveBeenCalled();
  expect(screen.getByLabelText('AI mode selected')).toBeOnTheScreen();
});
test('AI questions retain all typed text and cannot exceed the serialized limit', async () => {
  await mount();
  await fireEvent.changeText(screen.getByLabelText('Your question to Nara'), '/ai ' + 'a'.repeat(997));
  expect(screen.getByLabelText('Your question to Nara')).toHaveProp('value', 'a'.repeat(997));
  expect(screen.getByRole('button', { name: 'Send question' })).toBeDisabled();
  expect(request).not.toHaveBeenCalled();
});
test('a saved paid-request receipt is recovered without sending another request', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('00000000-0000-4000-8000-000000000099');
  request.mockResolvedValueOnce({
    success: true,
    data: {
      status: 'SUCCEEDED',
      allowance: balance,
      reply: { text: 'Recovered explanation', source: 'AI', creditsUsed: 1 },
    },
  });
  await mount();
  await screen.findByText('Check your previous AI request');
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('Recovered explanation');
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][0]).toBe('/user/assistant/requests/00000000-0000-4000-8000-000000000099');
  expect(request.mock.calls[0][1]).toBeUndefined();
});
test('pasted AI questions format without submitting and confirmation reuses its identity', async () => {
  request.mockImplementation(async (_path, _method, body) => {
    const input = body as { requestKey: string; message: string; allowAi: boolean };
    return {
      success: true,
      data: input.allowAi
        ? {
            confirmationRequired: false,
            allowance: { ...balance, remaining: 4 },
            reply: { text: 'Here is the explanation.', source: 'AI', creditsUsed: 1 },
          }
        : { confirmationRequired: true, requestKey: input.requestKey, cost: 1, allowance: balance },
    };
  });
  await mount();
  await fireEvent.changeText(screen.getByLabelText('Your question to Nara'), '/ai How do I plan balanced meals?');
  expect(request).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Send question' }));
  await screen.findByRole('button', { name: 'Confirm 1 credit & ask AI' });
  expect(request.mock.calls[0][2]).toMatchObject({ message: '/ai How do I plan balanced meals?', allowAi: false });
  const key = (request.mock.calls[0][2] as { requestKey: string }).requestKey;
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm 1 credit & ask AI' }));
  await screen.findByText('Here is the explanation.');
  expect(request.mock.calls[1][2]).toMatchObject({ requestKey: key, allowAi: true });
  expect(screen.getAllByText('How do I plan balanced meals?')).toHaveLength(1);
  expect(screen.queryByLabelText('AI mode selected')).toBeNull();
});
test('editing a confirmation keeps one question bubble and cancellation removes the unconfirmed entry', async () => {
  request.mockImplementation(async (_path, _method, body) => ({
    success: true,
    data: {
      confirmationRequired: true,
      requestKey: (body as { requestKey: string }).requestKey,
      allowance: balance,
      cost: 1,
    },
  }));
  await mount();
  await fireEvent.changeText(screen.getByLabelText('Your question to Nara'), 'Explain protein');
  await fireEvent.press(screen.getByRole('button', { name: 'Send question' }));
  await screen.findByRole('button', { name: 'Confirm 1 credit & ask AI' });
  await fireEvent.changeText(screen.getByLabelText('Your question to Nara'), 'Explain carbohydrates');
  expect(screen.queryByRole('button', { name: 'Confirm 1 credit & ask AI' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Send question' }));
  await screen.findByRole('button', { name: 'Confirm 1 credit & ask AI' });
  expect(screen.queryByText('Explain protein')).toBeNull();
  expect(screen.getAllByText('Explain carbohydrates')).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel request' }));
  await waitFor(() => expect(screen.queryByText('Explain carbohydrates')).toBeNull());
  expect(request).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('Your question to Nara')).toHaveProp('value', 'Explain carbohydrates');
});

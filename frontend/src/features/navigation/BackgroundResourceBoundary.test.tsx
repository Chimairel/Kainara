import { render, act } from '@testing-library/react';
import { StrictMode, useEffect } from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import BackgroundResourceBoundary from './BackgroundResourceBoundary';
import { LIVE_UPDATE_EVENT } from '@/lib/live-events';
import {
  clearSessionResourceCache,
  readSessionResource,
  refreshSessionResource,
  writeSessionResource,
} from '@/lib/session-resource-cache';

beforeEach(clearSessionResourceCache);

it('invalidates meal and grocery snapshots on live updates and local writes', () => {
  const view = render(<BackgroundResourceBoundary ownerId="user" />);
  for (const event of [LIVE_UPDATE_EVENT, 'kainara:membership-updated']) {
    writeSessionResource('user', 'user-meals-workspace', { meals: ['old'] });
    writeSessionResource('user', 'user-grocery-workspace', { current: 'old' });
    writeSessionResource('user', 'user-profile', { name: 'kept' });
    act(() => window.dispatchEvent(new Event(event)));
    expect(readSessionResource('user', 'user-meals-workspace')).toBeNull();
    expect(readSessionResource('user', 'user-grocery-workspace')).toBeNull();
    expect(readSessionResource('user', 'user-profile')).toEqual({ name: 'kept' });
  }
  view.unmount();
});

it('cleans up listeners and old owner data on account change', async () => {
  const remove = vi.spyOn(window, 'removeEventListener');
  const view = render(<BackgroundResourceBoundary ownerId="user" />);
  writeSessionResource('user', 'user-meals-workspace', { meals: ['private'] });
  view.rerender(<BackgroundResourceBoundary ownerId="other" />);
  await act(async () => {});
  expect(readSessionResource('user', 'user-meals-workspace')).toBeNull();
  expect(remove).toHaveBeenCalledWith(LIVE_UPDATE_EVENT, expect.any(Function));
  view.unmount();
  remove.mockRestore();
});

it('does not invalidate a foreground read during development effect replay', async () => {
  let finish!: (value: string[]) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<string[]>((resolve) => {
        finish = resolve;
      })
  );
  function ForegroundPage() {
    useEffect(() => {
      void refreshSessionResource('user', 'user-meals-workspace', fetcher);
    }, []);
    return null;
  }
  const view = render(
    <StrictMode>
      <BackgroundResourceBoundary ownerId="user" />
      <ForegroundPage />
    </StrictMode>
  );
  await act(async () => {
    finish(['saved meals']);
  });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(readSessionResource('user', 'user-meals-workspace')).toEqual(['saved meals']);
  view.unmount();
  await act(async () => {});
  expect(readSessionResource('user', 'user-meals-workspace')).toBeNull();
});

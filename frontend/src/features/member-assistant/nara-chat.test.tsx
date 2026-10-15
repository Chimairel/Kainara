import { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import NaraPortrait from './NaraPortrait';
import NaraLauncher from './NaraLauncher';
import AssistantConversation from './AssistantConversation';
import { DesktopAssistantPanel } from './MemberAssistantShell';
import type { MemberAssistantModel } from './useMemberAssistant';

const motionPreferences = vi.hoisted(() => ({ reduced: false }));
vi.mock('motion/react', async importOriginal => ({ ...await importOriginal<typeof import('motion/react')>(), useReducedMotion: () => motionPreferences.reduced }));

const model = {
  messages: [], busy: false, pending: null, allowance: { tier: 'FREE', cap: 5, remaining: 5, resetsAt: '2026-10-18T16:00:00Z' },
  draft: '', error: null, send: vi.fn(), confirm: vi.fn(), cancel: vi.fn(), newChat: vi.fn(), setOpen: vi.fn(), setDraft: vi.fn(),
} as unknown as MemberAssistantModel;
afterEach(() => { motionPreferences.reduced = false; vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('loops the thinking gaze in order, faces front afterwards, and clears its timer', () => {
  vi.useFakeTimers();
  const view = render(<NaraPortrait mood="thinking" />);
  const direction = () => view.container.querySelector('[style*="directions"]') as HTMLElement;
  expect(direction().style.backgroundPosition).toBe('0% 0%');
  act(() => { vi.advanceTimersByTime(700); });
  expect(direction().style.backgroundPosition).toBe('50% 50%');
  act(() => { vi.advanceTimersByTime(700); });
  expect(direction().style.backgroundPosition).toBe('100% 0%');
  act(() => { vi.advanceTimersByTime(700); });
  expect(direction().style.backgroundPosition).toBe('0% 0%');
  view.rerender(<NaraPortrait mood="front" />);
  expect(direction().style.backgroundPosition).toBe('50% 50%');
  expect(vi.getTimerCount()).toBe(0);
});

it('pauses thinking while the document is hidden', () => {
  vi.useFakeTimers();
  let hidden = false;
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  render(<NaraPortrait mood="thinking" />);
  hidden = true;
  fireEvent(document, new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(0);
  hidden = false;
  fireEvent(document, new Event('visibilitychange'));
  expect(vi.getTimerCount()).toBe(1);
});

it('keeps the thinking portrait still with reduced motion and clears the loop on unmount', () => {
  vi.useFakeTimers();
  motionPreferences.reduced = true;
  const view = render(<NaraPortrait mood="thinking" />);
  const direction = view.container.querySelector('[style*="directions"]') as HTMLElement;
  expect(direction.style.backgroundPosition).toBe('50% 50%');
  expect(vi.getTimerCount()).toBe(0);
  motionPreferences.reduced = false;
  view.rerender(<NaraPortrait mood="thinking" />);
  expect(vi.getTimerCount()).toBe(1);
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it('uses the dizzy artwork for request failures and exhausted-credit consent, then recovers', () => {
  Element.prototype.scrollIntoView = vi.fn();
  const view = render(<AssistantConversation model={{ ...model, error: 'Request failed' }} titleId="nara" />);
  const reaction = () => view.container.querySelector('[style*="reactions"]') as HTMLElement;
  expect(reaction().style.opacity).toBe('1');
  expect(reaction().style.backgroundPosition).toBe('50% 100%');
  view.rerender(<AssistantConversation model={{ ...model, pending: { requestKey: 'key' } as MemberAssistantModel['pending'], allowance: { ...model.allowance!, remaining: 0 } }} titleId="nara" />);
  expect(reaction().style.opacity).toBe('1');
  expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
  view.rerender(<AssistantConversation model={model} titleId="nara" />);
  expect(reaction().style.opacity).toBe('0');
});

it('resizes with keyboard limits and captured pointer drags, and ignores movement after release', () => {
  function Panel() {
    const [width, setWidth] = useState(420);
    return <DesktopAssistantPanel model={model} titleId="nara" width={width} onWidthChange={setWidth} />;
  }
  render(<Panel />);
  const handle = screen.getByRole('separator', { name: 'Resize Nara chat' });
  handle.setPointerCapture = vi.fn(); handle.releasePointerCapture = vi.fn();
  fireEvent.keyDown(handle, { key: 'ArrowLeft' });
  expect(handle).toHaveAttribute('aria-valuenow', '444');
  fireEvent.keyDown(handle, { key: 'Home' });
  fireEvent.keyDown(handle, { key: 'ArrowRight' });
  expect(handle).toHaveAttribute('aria-valuenow', '360');
  const move = (type: string, x: number) => {
    const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x });
    Object.defineProperty(event, 'pointerId', { value: 1 });
    fireEvent(handle, event);
  };
  move('pointerdown', 800); move('pointermove', 650);
  expect(handle).toHaveAttribute('aria-valuenow', '510');
  move('pointerup', 650); move('pointermove', 600);
  expect(handle).toHaveAttribute('aria-valuenow', '510');
  fireEvent.keyDown(handle, { key: 'End' });
  expect(handle.getAttribute('aria-valuenow')).toBe(handle.getAttribute('aria-valuemax'));
  vi.stubGlobal('innerWidth', 390);
  fireEvent(window, new Event('resize'));
  expect(handle).toHaveAttribute('aria-valuenow', '360');
});

it('tracks the mouse only for the launcher, with no nested interactive portrait', () => {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('hover: hover'), addListener: vi.fn(), removeListener: vi.fn() })));
  const listen = vi.spyOn(window, 'addEventListener');
  const remove = vi.spyOn(window, 'removeEventListener');
  const view = render(<NaraPortrait mood="follow" />);
  expect(listen).toHaveBeenCalledWith('pointermove', expect.any(Function), { passive: true });
  expect(view.container.querySelector('button')).toBeNull();
  view.rerender(<NaraPortrait mood="front" />);
  expect(remove).toHaveBeenCalledWith('pointermove', expect.any(Function));
});

it('varies greetings on re-entry and clears the greeting and smile on activation', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  const onOpen = vi.fn();
  render(<NaraLauncher id="nara" panelId="chat" onOpen={onOpen} />);
  const button = screen.getByRole('button', { name: 'Open Nara chat' });
  fireEvent.pointerEnter(button.parentElement!);
  const firstGreeting = screen.getByRole('tooltip').textContent;
  expect(button.querySelector('[data-nara-mood]')).toHaveAttribute('data-nara-mood', 'smile');
  fireEvent.pointerLeave(button.parentElement!);
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(button.querySelector('[data-nara-mood]')).toHaveAttribute('data-nara-mood', 'follow');
  fireEvent.pointerEnter(button.parentElement!);
  expect(screen.getByRole('tooltip').textContent).not.toBe(firstGreeting);
  fireEvent.click(button);
  expect(onOpen).toHaveBeenCalledOnce();
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(button.querySelector('[data-nara-mood]')).toHaveAttribute('data-nara-mood', 'follow');
});

it('does not reopen the tooltip or smile when the closed chat restores launcher focus', () => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
  render(<NaraLauncher id="nara" panelId="chat" onOpen={vi.fn()} />);
  const button = screen.getByRole('button', { name: 'Open Nara chat' });
  // jsdom does not model the browser's keyboard focus-visible heuristic.
  const matches = button.matches.bind(button);
  vi.spyOn(button, 'matches').mockImplementation(selector => selector === ':focus-visible' || matches(selector));
  button.setAttribute('data-nara-restoring-focus', '');
  act(() => button.focus());
  button.removeAttribute('data-nara-restoring-focus');
  expect(document.activeElement).toBe(button);
  expect(screen.queryByRole('tooltip')).toBeNull();
  expect(button.querySelector('[data-nara-mood]')).toHaveAttribute('data-nara-mood', 'follow');
  act(() => { button.blur(); button.focus(); });
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  fireEvent.keyDown(button, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).toBeNull();
});

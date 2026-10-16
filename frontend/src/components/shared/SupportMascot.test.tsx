import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import SupportMascot, { supportMascotAssets } from './SupportMascot';

let reduced = false;
let listeners: Set<() => void>;
const originalAnimate = HTMLElement.prototype.animate;

beforeEach(() => {
  reduced = false;
  listeners = new Set();
  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() { return query.includes('prefers-reduced-motion') ? reduced : true; },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener),
  }));
  vi.stubGlobal('PointerEvent', MouseEvent);
  HTMLElement.prototype.animate = vi.fn();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); HTMLElement.prototype.animate = originalAnimate; });

function layers(button: HTMLElement) {
  return button.querySelectorAll<HTMLSpanElement>('span > span');
}

it('uses the VA atlases and shows spiral eyes after four quick clicks without submitting', () => {
  vi.useFakeTimers();
  const submit = vi.fn((event) => event.preventDefault());
  render(<form onSubmit={submit}><SupportMascot /></form>);
  const button = screen.getByRole('button', { name: 'Boop the Nara' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveStyle({ width: '160px', height: '160px' });
  const [directions, reactions] = layers(button);
  expect(directions.style.backgroundImage).toContain(supportMascotAssets.directions);
  expect(reactions.style.backgroundImage).toContain(supportMascotAssets.reactions);
  for (let i = 0; i < 4; i++) fireEvent.click(button);
  expect(reactions).toHaveStyle({ opacity: '1', backgroundPosition: '50% 100%' });
  act(() => vi.advanceTimersByTime(1100));
  expect(directions).toHaveStyle({ opacity: '1' });
  expect(submit).not.toHaveBeenCalled();
});

it('smiles on mouse hover while allowing a pointer boop to show its own reaction', () => {
  vi.useFakeTimers();
  render(<SupportMascot />);
  const button = screen.getByRole('button', { name: 'Boop the Nara' });
  const wrapper = button.parentElement!;
  // JSDOM needs the pointer type supplied explicitly on this synthetic event.
  const enter = new MouseEvent('pointerover', { bubbles: true });
  Object.defineProperty(enter, 'pointerType', { value: 'mouse' });
  fireEvent(wrapper, enter);
  const [, reactions] = layers(button);
  expect(reactions).toHaveStyle({ opacity: '1', backgroundPosition: '100% 100%' });
  fireEvent.pointerDown(button);
  fireEvent.click(button);
  expect(reactions).toHaveStyle({ opacity: '1', backgroundPosition: '0% 0%' });
  act(() => vi.advanceTimersByTime(120));
  expect(reactions).toHaveStyle({ opacity: '1', backgroundPosition: '50% 0%' });
});

it('responds to all eight pointer sectors in viewer order', () => {
  render(<SupportMascot />);
  const button = screen.getByRole('button', { name: 'Boop the Nara' });
  vi.spyOn(button, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, width: 160, height: 160, bottom: 260 } as DOMRect);
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 0; });
  const [directions] = layers(button);
  for (const [x, y, position] of [
    [0, 0, '0% 0%'], [180, 0, '50% 0%'], [360, 0, '100% 0%'],
    [0, 180, '0% 50%'], [360, 180, '100% 50%'],
    [0, 360, '0% 100%'], [180, 360, '50% 100%'], [360, 360, '100% 100%'],
  ] as const) {
    fireEvent.pointerMove(window, { clientX: x, clientY: y });
    expect(directions).toHaveStyle({ backgroundPosition: position });
  }
});

it('switches live to a static central portrait for reduced motion and removes listeners', () => {
  const { unmount } = render(<SupportMascot size={1024} />);
  expect(screen.getByRole('button', { name: 'Boop the Nara' })).toBeInTheDocument();
  act(() => { reduced = true; listeners.forEach((listener) => listener()); });
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Nara wearing a support headset' })).toHaveStyle({ backgroundPosition: '50% 50%' });
  act(() => { reduced = false; listeners.forEach((listener) => listener()); });
  expect(screen.getByRole('button', { name: 'Boop the Nara' })).toBeInTheDocument();
  unmount();
  expect(listeners.size).toBe(0);
});

it('supports keyboard boops without submitting the surrounding form', async () => {
  const submit = vi.fn((event) => event.preventDefault());
  const user = userEvent.setup();
  render(<form onSubmit={submit}><SupportMascot /></form>);
  const button = screen.getByRole('button', { name: 'Boop the Nara' });
  await user.tab();
  expect(button).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(layers(button)[1]).toHaveStyle({ opacity: '1' });
  expect(submit).not.toHaveBeenCalled();
});

import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import RndQueueDocument, { ReviewDocumentPage } from './RndQueueDocument';

function Fixture({ onBack, claimed = true, focusSheet }: { onBack: () => void; claimed?: boolean; focusSheet?: { title: string; request: number } }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  return (
    <RndQueueDocument
      title="RND record"
      contentKey="case-1"
      expanded={expanded}
      onExpandedChange={setExpanded}
      onBack={onBack}
      focusSheet={focusSheet}
      actions={<button>Claim control</button>}
      decision={
        claimed ? (
          <label>
            Decision note
            <input value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        ) : undefined
      }
    >
      <ReviewDocumentPage page={1} title="Member profile">
        <p>Recorded condition</p>
      </ReviewDocumentPage>
      <ReviewDocumentPage page={2} title="Meal evidence">
        <div data-canvas-scroll role="region" aria-label="Reference scroll area"><p>Recorded ingredient</p></div>
      </ReviewDocumentPage>
    </RndQueueDocument>
  );
}

it('clears hover hints when expanding and shrinking without reopening them on automatic focus', async () => {
  render(<Fixture onBack={vi.fn()} />);
  const expand = screen.getByRole('button', { name: 'Expand canvas' });
  fireEvent.pointerEnter(expand.parentElement!);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Expand canvas');
  fireEvent.click(expand);
  const fullscreen = screen.getByRole('dialog', { name: /RND record.*fullscreen/ });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(within(fullscreen).getByRole('region', { name: 'RND review canvas' })).toHaveFocus();
  const shrink = within(fullscreen).getByRole('button', { name: 'Exit fullscreen' });
  fireEvent.pointerEnter(shrink.parentElement!);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Exit fullscreen');
  fireEvent.click(shrink);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Expand canvas' })).toHaveFocus());
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  const restored = screen.getByRole('button', { name: 'Expand canvas' });
  fireEvent.pointerEnter(restored.parentElement!);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Expand canvas');
});

it('keeps decisions inside the canvas, unscaled, with drafts and layout preserved across fullscreen', async () => {
  render(<Fixture onBack={vi.fn()} />);
  const dock = screen.getByRole('region', { name: 'Review decisions' });
  expect(dock.closest('[data-canvas-world]')).toBeNull();
  const handle = screen.getByRole('button', { name: 'Move Meal evidence sheet' });
  fireEvent.keyDown(handle, { key: 'ArrowDown' });
  const sheet = document.querySelector('[data-canvas-sheet="1"]') as HTMLElement;
  expect(sheet.style.top).toBe('20px');
  fireEvent.change(screen.getByLabelText('Decision note'), { target: { value: 'Saved draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Expand canvas' }));
  const dialog = screen.getByRole('dialog', { name: /RND record.*fullscreen/ });
  expect(within(dialog).getByLabelText('Decision note')).toHaveValue('Saved draft');
  expect(dialog.querySelector('[data-canvas-sheet="1"]')).toHaveStyle({ top: '20px' });
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByLabelText('Decision note')).toHaveValue('Saved draft');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Expand canvas' })).toHaveFocus());
});

it('changes H/V tools without hijacking typing or modified shortcuts', () => {
  render(<Fixture onBack={vi.fn()} />);
  fireEvent.keyDown(document.body, { key: 'h' });
  expect(screen.getByRole('combobox', { name: 'Hand tool (H)' })).toBeInTheDocument();
  fireEvent.keyDown(document.body, { key: 'v' });
  expect(screen.getByRole('combobox', { name: 'Move tool (V)' })).toBeInTheDocument();
  fireEvent.keyDown(screen.getByLabelText('Decision note'), { key: 'h' });
  expect(screen.getByRole('combobox', { name: 'Move tool (V)' })).toBeInTheDocument();
  fireEvent.keyDown(document.body, { key: 'h', ctrlKey: true });
  expect(screen.getByRole('combobox', { name: 'Move tool (V)' })).toBeInTheDocument();
});

it('separates bottom editing tools from zoom controls and preserves their placement in fullscreen', () => {
  render(<Fixture onBack={vi.fn()} />);
  const tools = () => screen.getByRole('toolbar', { name: 'Canvas tools' });
  expect(tools()).toHaveClass('absolute', 'bottom-4', 'left-1/2', '-translate-x-1/2');
  expect(within(tools()).getByRole('combobox', { name: 'Move tool (V)' })).toBeInTheDocument();
  expect(within(tools()).queryByRole('button', { name: 'Zoom in' })).not.toBeInTheDocument();
  expect(within(screen.getByRole('toolbar', { name: 'Canvas view controls' })).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
  expect(tools().closest('[data-canvas-world]')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Expand canvas' }));
  expect(tools()).toHaveClass('bottom-4', 'left-1/2');
  expect(tools().closest('[role="dialog"]')).not.toBeNull();
  fireEvent.click(within(tools()).getByRole('combobox', { name: 'Move tool (V)' }));
  fireEvent.keyDown(within(tools()).getByRole('combobox', { name: 'Move tool (V)' }), { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(within(tools()).getByRole('combobox', { name: 'Move tool (V)' })).toHaveAttribute('aria-expanded', 'false');
});

it('requires a claim for decisions and preserves queue navigation', () => {
  const back = vi.fn();
  render(<Fixture onBack={back} claimed={false} />);
  expect(screen.queryByLabelText('Decision note')).not.toBeInTheDocument();
  expect(screen.getByText(/Claim this review/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to queue' }));
  expect(back).toHaveBeenCalledOnce();
});

it('captures Ctrl/Command wheel inside the canvas before and after fullscreen portals', () => {
  render(<Fixture onBack={vi.fn()} />);
  const scale = () =>
    Number(
      document
        .querySelector('[data-canvas-world]')
        ?.getAttribute('style')
        ?.match(/scale\(([^)]+)\)/)?.[1]
    );
  const wheel = (node: HTMLElement, deltaY: number, modifier: 'ctrlKey' | 'metaKey') => {
    const event = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY,
      clientX: 50,
      clientY: 70,
      [modifier]: true,
    });
    fireEvent(node, event);
    expect(event.defaultPrevented).toBe(true);
  };
  const before = scale();
  wheel(screen.getByRole('region', { name: 'Review canvas viewport' }), -100, 'ctrlKey');
  expect(scale()).toBeGreaterThan(before);
  fireEvent.click(screen.getByRole('button', { name: 'Expand canvas' }));
  const expandedScale = scale();
  wheel(screen.getByRole('region', { name: 'Review canvas viewport' }), -100, 'ctrlKey');
  expect(scale()).toBeGreaterThan(expandedScale);
  wheel(screen.getByRole('region', { name: 'Review canvas viewport' }), 100, 'metaKey');
  expect(scale()).toBeCloseTo(expandedScale);
  const dockScale = scale();
  wheel(screen.getByLabelText('Decision note'), -100, 'ctrlKey');
  expect(scale()).toBeGreaterThan(dockScale);
  fireEvent.click(screen.getByRole('button', { name: 'Exit fullscreen' }));
  const returnedScale = scale();
  wheel(screen.getByRole('region', { name: 'Review canvas viewport' }), 100, 'ctrlKey');
  expect(scale()).toBeLessThan(returnedScale);
});

it('preserves wheel behavior outside the canvas and normal decision-dock scrolling', () => {
  render(
    <>
      <Fixture onBack={vi.fn()} />
      <button>Outside canvas</button>
    </>
  );
  const outside = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, ctrlKey: true });
  fireEvent(screen.getByRole('button', { name: 'Outside canvas' }), outside);
  expect(outside.defaultPrevented).toBe(false);
  const note = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 });
  fireEvent(screen.getByLabelText('Decision note'), note);
  expect(note.defaultPrevented).toBe(false);
  const pan = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 });
  fireEvent(screen.getByRole('region', { name: 'Review canvas viewport' }), pan);
  expect(pan.defaultPrevented).toBe(true);
});

it('keeps short sheets visible when fitting alongside exceptionally long evidence at minimum zoom', () => {
  render(<Fixture onBack={vi.fn()} />);
  const viewport = screen.getByRole('region', { name: 'Review canvas viewport' });
  Object.defineProperties(viewport, { clientWidth: { value: 1280 }, clientHeight: { value: 500 } });
  const sheet = document.querySelector('[data-canvas-sheet="1"]')!;
  Object.defineProperty(sheet, 'offsetHeight', { value: 10_000 });
  fireEvent.click(screen.getByRole('button', { name: 'Fit all sheets' }));
  const style = document.querySelector('[data-canvas-world]')!.getAttribute('style');
  expect(style).toMatch(/translate\([^,]+, 24px\)/);
  expect(style).toContain('scale(0.1)');
});

it('focuses the requested reference sheet without moving the existing sheets', () => {
  const back = vi.fn();
  const { rerender } = render(<Fixture onBack={back} />);
  Object.defineProperty(screen.getByRole('region', { name: 'Review canvas viewport' }), 'clientWidth', { value: 1280 });
  fireEvent.keyDown(screen.getByRole('button', { name: 'Move Member profile sheet' }), { key: 'ArrowDown' });
  fireEvent.keyDown(document.body, { key: 'h' });
  rerender(<Fixture onBack={back} focusSheet={{ title: 'Meal evidence', request: 1 }} />);
  expect(document.querySelector('[data-canvas-sheet="0"]')).toHaveStyle({ top: '20px' });
  expect(document.querySelector('[data-canvas-sheet="1"]')).toHaveClass('outline');
  expect(screen.getByRole('combobox', { name: 'Move tool (V)' })).toBeInTheDocument();
  expect(document.querySelector('[data-canvas-world]')?.getAttribute('style')).toContain('64px) scale(1)');
});

it('lets reference tables scroll natively while keeping modified wheel zoom', () => {
  render(<Fixture onBack={vi.fn()} />);
  const target = screen.getByRole('region', { name: 'Reference scroll area' });
  const scroll = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 100 });
  fireEvent(target, scroll);
  expect(scroll.defaultPrevented).toBe(false);
  const zoom = new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: -100, ctrlKey: true });
  fireEvent(target, zoom);
  expect(zoom.defaultPrevented).toBe(true);
});

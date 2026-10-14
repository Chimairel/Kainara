import { fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import CanvasToolButton from './CanvasToolButton';
import CanvasMenu from './CanvasMenu';
import * as Dialog from '@radix-ui/react-dialog';

it('names a disabled action on hover without triggering it', () => {
  const action = vi.fn();
  render(<CanvasToolButton disabled aria-label="Approve" title="Approve meal" onClick={action}>Approve</CanvasToolButton>);
  const button = screen.getByRole('button', { name: 'Approve' });
  fireEvent.pointerEnter(button.parentElement!);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Approve meal');
  expect(button).toHaveAccessibleDescription('Approve meal');
  fireEvent.click(button);
  expect(action).not.toHaveBeenCalled();
  fireEvent.pointerLeave(button.parentElement!);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('shows a keyboard hint and dismisses it with Escape without closing the canvas', () => {
  const parentEscape = vi.fn();
  render(<div onKeyDown={parentEscape}><CanvasToolButton aria-label="Reject" title="Reject meal">Reject</CanvasToolButton></div>);
  const button = screen.getByRole('button', { name: 'Reject' });
  fireEvent.focus(button);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Reject meal');
  fireEvent.keyDown(button, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(parentEscape).not.toHaveBeenCalled();
});

it('names the menu, then hides its hint when opening the page list', () => {
  render(<CanvasMenu label="Add page" icon={<span>+</span>} items={[{ value: 'message', label: 'Message' }]} onSelect={vi.fn()} />);
  const menu = screen.getByRole('combobox', { name: 'Add page' });
  fireEvent.focus(menu);
  expect(menu).toHaveAccessibleDescription('Add page');
  fireEvent.click(menu);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Message' })).toBeInTheDocument();
});

it('dismisses a hint before a surrounding Radix fullscreen dialog handles Escape', () => {
  const onOpenChange = vi.fn();
  render(<Dialog.Root open onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Content aria-describedby={undefined}>
    <Dialog.Title>Fullscreen review</Dialog.Title>
    <CanvasToolButton aria-label="Swap" title="Swap meal">Swap</CanvasToolButton>
  </Dialog.Content></Dialog.Portal></Dialog.Root>);
  const button = screen.getByRole('button', { name: 'Swap' });
  fireEvent.focus(button);
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  fireEvent.keyDown(button, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog', { name: 'Fullscreen review' })).toBeInTheDocument();
});

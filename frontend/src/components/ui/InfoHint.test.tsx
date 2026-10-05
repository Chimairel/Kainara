import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import InfoHint from './InfoHint';

afterEach(() => vi.useRealTimers());

describe('InfoHint', () => {
  it('keeps hover content available when moving from the icon into the panel', () => {
    vi.useFakeTimers();
    render(<InfoHint label="Details">Planning details</InfoHint>);
    const trigger = screen.getByRole('button', { name: 'Details' });
    fireEvent.pointerEnter(trigger);
    const hint = screen.getByRole('tooltip');
    expect(trigger).toHaveAttribute('aria-describedby', hint.id);
    fireEvent.pointerLeave(trigger);
    fireEvent.pointerEnter(hint);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.pointerLeave(hint);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('pins on click and dismisses on another click or outside interaction', () => {
    render(<InfoHint label="Details">Planning details</InfoHint>);
    const trigger = screen.getByRole('button', { name: 'Details' });
    fireEvent.click(trigger);
    fireEvent.pointerLeave(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('opens on keyboard focus and closes only the hint on Escape inside a dialog', () => {
    const outerEscape = vi.fn();
    render(
      <div role="dialog" aria-label="Plans" onKeyDown={outerEscape}>
        <InfoHint label="Details">Planning details</InfoHint>
      </div>
    );
    const trigger = screen.getByRole('button', { name: 'Details' });
    act(() => trigger.focus());
    expect(within(screen.getByRole('dialog')).getByRole('tooltip')).toBeInTheDocument();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(outerEscape).not.toHaveBeenCalled();
    expect(trigger).toHaveFocus();
  });
});

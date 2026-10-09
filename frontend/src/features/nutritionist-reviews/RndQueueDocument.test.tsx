import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import RndQueueDocument, { ReviewDocumentPage } from './RndQueueDocument';

function Fixture({ onBack, claimed = true }: { onBack: () => void; claimed?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [note, setNote] = useState('');
  return (
    <RndQueueDocument
      title="RND record"
      contentKey="case-1"
      expanded={expanded}
      onExpandedChange={setExpanded}
      onBack={onBack}
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
        <p>Recorded ingredient</p>
      </ReviewDocumentPage>
    </RndQueueDocument>
  );
}

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
  const hand = screen.getByRole('button', { name: 'Hand tool (H)' });
  const select = screen.getByRole('button', { name: 'Select tool (V)' });
  fireEvent.keyDown(document.body, { key: 'h' });
  expect(hand).toHaveAttribute('aria-pressed', 'true');
  fireEvent.keyDown(document.body, { key: 'v' });
  expect(select).toHaveAttribute('aria-pressed', 'true');
  fireEvent.keyDown(screen.getByLabelText('Decision note'), { key: 'h' });
  expect(select).toHaveAttribute('aria-pressed', 'true');
  fireEvent.keyDown(document.body, { key: 'h', ctrlKey: true });
  expect(select).toHaveAttribute('aria-pressed', 'true');
});

it('requires a claim for decisions and preserves queue navigation', () => {
  const back = vi.fn();
  render(<Fixture onBack={back} claimed={false} />);
  expect(screen.queryByLabelText('Decision note')).not.toBeInTheDocument();
  expect(screen.getByText(/Claim this review/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to queue' }));
  expect(back).toHaveBeenCalledOnce();
});

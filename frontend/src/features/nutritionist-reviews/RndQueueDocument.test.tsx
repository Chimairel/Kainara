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

it('keeps decisions unscaled and retains their draft when entering and leaving fullscreen', async () => {
  render(<Fixture onBack={vi.fn()} />);
  const decision = screen.getByRole('region', { name: 'Review decision' });
  expect(decision.closest('[data-document-page]')).toBeNull();
  fireEvent.change(screen.getByLabelText('Decision note'), { target: { value: 'Saved draft' } });
  fireEvent.click(screen.getByRole('button', { name: 'Expand document' }));
  const dialog = screen.getByRole('dialog', { name: 'RND record — fullscreen' });
  expect(within(dialog).getByText('Recorded condition')).toBeInTheDocument();
  expect(within(dialog).queryByLabelText('Decision note')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Review decision' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(decision).toHaveFocus());
  expect(screen.getByLabelText('Decision note')).toHaveValue('Saved draft');
});

it('does not offer a decision before a claim and preserves queue navigation', () => {
  const back = vi.fn();
  render(<Fixture onBack={back} claimed={false} />);
  expect(screen.queryByRole('region', { name: 'Review decision' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Review decision' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to queue' }));
  expect(back).toHaveBeenCalledOnce();
});

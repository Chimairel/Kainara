import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import DocumentViewer from './DocumentViewer';

function Fixture({ title = 'Test record', contentKey = 'v1' }: { title?: string; contentKey?: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <DocumentViewer title={title} contentKey={contentKey} expanded={expanded} onExpandedChange={setExpanded}>
      <div data-document-page="1">First sheet</div>
      <div data-document-page="2">Second sheet</div>
    </DocumentViewer>
  );
}

it('opens a body-level fullscreen dialog and restores focus after Escape', async () => {
  const { container } = render(<Fixture />);
  fireEvent.click(screen.getByRole('button', { name: 'Expand document' }));
  const dialog = screen.getByRole('dialog', { name: 'Test record — fullscreen' });
  expect(container.contains(dialog)).toBe(false);
  expect(within(dialog).getByRole('button', { name: 'Next page' })).toBeEnabled();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Expand document' })).toHaveFocus());
});

it('keeps page navigation local to each reader and resets when its record changes', () => {
  const { rerender } = render(
    <>
      <Fixture title="A" />
      <Fixture title="B" />
    </>
  );
  const [first, second] = screen.getAllByRole('region', { name: 'Document viewer', exact: true });
  fireEvent.click(within(first).getByRole('button', { name: 'Next page' }));
  expect(within(first).getByRole('button', { name: 'Previous page' })).toBeEnabled();
  expect(within(second).getByRole('button', { name: 'Previous page' })).toBeDisabled();
  rerender(
    <>
      <Fixture title="A" contentKey="v2" />
      <Fixture title="B" />
    </>
  );
  expect(within(first).getByRole('button', { name: 'Previous page' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument();
});

it('uses caller PDF export and blocks duplicate download requests', () => {
  const download = vi.fn();
  const props = { title: 'Export', contentKey: 'v1', expanded: false, onExpandedChange: vi.fn(), onDownload: download };
  const { rerender } = render(
    <DocumentViewer {...props}>
      <p data-document-page>Record</p>
    </DocumentViewer>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));
  expect(download).toHaveBeenCalledOnce();
  rerender(
    <DocumentViewer {...props} downloading>
      <p data-document-page>Record</p>
    </DocumentViewer>
  );
  expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
});

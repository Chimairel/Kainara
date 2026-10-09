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
  const [first, second] = screen.getAllByRole('region', { name: 'Document viewer' });
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

it('uses one fit button that changes mode and icon', () => {
  render(<Fixture />);
  const fitButton = screen.getByRole('button', { name: 'Fit to page' });
  const widthIcon = fitButton.querySelector('svg')?.getAttribute('class');
  expect(screen.queryByRole('button', { name: 'Fit to width' })).not.toBeInTheDocument();
  fireEvent.click(fitButton);
  expect(screen.getByRole('button', { name: 'Fit to width' })).toBe(fitButton);
  expect(fitButton.querySelector('svg')?.getAttribute('class')).not.toBe(widthIcon);
  fireEvent.click(fitButton);
  expect(screen.getByRole('button', { name: 'Fit to page' })).toBe(fitButton);
  expect(fitButton.querySelector('svg')?.getAttribute('class')).toBe(widthIcon);
});

it('renders actual sheets in inert thumbnails without duplicate IDs and keeps the sidebar open', async () => {
  const { container, rerender } = render(
    <DocumentViewer title="Preview" contentKey="one" expanded={false} onExpandedChange={vi.fn()}>
      <div id="original-sheet" data-document-page="1">
        <h2>Recorded values</h2>
        <a href="/sources">Original reference</a>
      </div>
    </DocumentViewer>
  );
  fireEvent.click(screen.getByRole('button', { name: 'Document pages' }));
  const thumbnail = container.querySelector('[data-document-thumbnail]')!;
  expect(thumbnail).toHaveTextContent('Recorded values');
  expect(thumbnail.querySelector('a')).toHaveTextContent('Original reference');
  expect(thumbnail.querySelector('[id]')).toBeNull();
  expect(thumbnail.parentElement).toHaveAttribute('inert');
  expect(thumbnail.parentElement).toHaveAttribute('aria-hidden', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Page 1' }));
  expect(screen.getByRole('complementary', { name: 'Document page navigation' })).toBeInTheDocument();
  rerender(
    <DocumentViewer title="Preview" contentKey="one" expanded={false} onExpandedChange={vi.fn()}>
      <div id="original-sheet" data-document-page="1">
        <h2>Updated recorded values</h2>
      </div>
    </DocumentViewer>
  );
  await waitFor(() => expect(thumbnail).toHaveTextContent('Updated recorded values'));
});

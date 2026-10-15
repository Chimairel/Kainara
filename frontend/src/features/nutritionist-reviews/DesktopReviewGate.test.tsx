import { ThemeProvider } from '@/lib/context/ThemeContext';

import { act, fireEvent, render as renderUi, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import DesktopReviewGate from './DesktopReviewGate';
import RndQueueDocument, { ReviewDocumentPage } from './RndQueueDocument';
import Modal from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';

const render = (ui: Parameters<typeof renderUi>[0]) => renderUi(ui, { wrapper: ThemeProvider });

afterEach(() => vi.unstubAllGlobals());
it.each([true, false])('mounts review work only with a desktop-sized viewport: %s', (matches) => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  );
  const mounted = vi.fn();
  function Workspace() {
    mounted();
    return <p>Review workspace</p>;
  }
  render(
    <DesktopReviewGate>
      <Workspace />
    </DesktopReviewGate>
  );
  expect(mounted.mock.calls.length > 0).toBe(matches);
  if (!matches) expect(screen.getByRole('heading', { name: 'Use a desktop to review meals' })).toBeInTheDocument();
});

it('preserves the open review, notes, sheet positions and fullscreen across inspect-width changes', async () => {
  const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  const mounted = vi.fn();
  const unmounted = vi.fn();
  function Workspace() {
    useEffect(() => { mounted(); return unmounted; }, []);
    const [expanded, setExpanded] = useState(false);
    const [note, setNote] = useState('');
    return <RndQueueDocument title="Open claimed case" contentKey="case" expanded={expanded}
      onExpandedChange={setExpanded} onBack={vi.fn()} actions={<button>Claimed by you</button>}
      decision={<label>Review note<input value={note} onChange={event => setNote(event.target.value)} /></label>}>
      <ReviewDocumentPage page={1} title="Meal evidence"><p>Recorded meal</p></ReviewDocumentPage>
    </RndQueueDocument>;
  }
  render(<DesktopReviewGate><Workspace /></DesktopReviewGate>);
  fireEvent.change(screen.getByLabelText('Review note'), { target: { value: 'Unsubmitted reasoning' } });
  fireEvent.keyDown(screen.getByRole('button', { name: 'Move Meal evidence sheet' }), { key: 'ArrowDown' });
  fireEvent.click(screen.getByRole('button', { name: 'Expand canvas' }));
  expect(screen.getByRole('dialog', { name: /Open claimed case/ })).toBeInTheDocument();
  const resize = (matches: boolean) => act(() => {
    media.matches = matches;
    media.addEventListener.mock.calls[0][1]();
  });
  resize(false);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('heading', { name: 'Use a desktop to review meals' })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Claimed by you' })).not.toBeInTheDocument();
  expect(unmounted).not.toHaveBeenCalled();
  fireEvent.keyDown(document, { key: 'h' });
  resize(true);
  await screen.findByRole('dialog', { name: /Open claimed case/ });
  expect(screen.getByLabelText('Review note')).toHaveValue('Unsubmitted reasoning');
  expect(screen.getByRole('button', { name: 'Claimed by you' })).toBeVisible();
  expect(screen.getByRole('article', { name: 'Meal evidence' }).closest('[data-canvas-sheet]')).toHaveStyle({ top: '20px' });
  expect(screen.getByRole('combobox', { name: 'Move tool (V)' })).toBeInTheDocument();
  expect(mounted).toHaveBeenCalledOnce();
});

it('hides portalled tools while narrow without closing their parent draft', async () => {
  const media = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', vi.fn(() => media));
  const close = vi.fn();
  function Workspace() {
    const [note, setNote] = useState('');
    return <Modal isOpen onClose={close} title="Review tool">
      <label>Draft<input value={note} onChange={event => setNote(event.target.value)} /></label>
      <Select value="" onChange={vi.fn()} aria-label="Premade page" options={[{ value:'message', label:'Message' }]} />
    </Modal>;
  }
  render(<DesktopReviewGate><Workspace /></DesktopReviewGate>);
  fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Unsaved question' } });
  fireEvent.click(screen.getByRole('combobox', { name: 'Premade page' }));
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  act(() => { media.matches = false; media.addEventListener.mock.calls[0][1](); });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Use a desktop to review meals' })).toBeVisible();
  expect(close).not.toHaveBeenCalled();
  act(() => { media.matches = true; media.addEventListener.mock.calls[0][1](); });
  await screen.findByRole('dialog', { name: 'Review tool' });
  expect(screen.getByLabelText('Draft')).toHaveValue('Unsaved question');
});
